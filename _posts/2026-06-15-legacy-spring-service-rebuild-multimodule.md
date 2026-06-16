---
layout: post
title: "레거시 Spring 서비스 재구성하기 - FE, API, Batch 분리와 멀티모듈"
date: 2026-06-15
category: spring
tags: [spring, architecture, multi-module, batch, react]
published: false
---

3년 전에 런칭된 서비스를 유지보수하게 되었다.  
서비스 자체는 계속 운영되고 있었지만, 코드를 열어보니 기능을 추가하거나 장애를 추적할 때마다 기존 구조를 계속 따라가는 것이 오히려 더 큰 비용이 될 것 같았다.

특히 인상적이었던 부분은 `FE`와 `BE`가 나뉘어 있기는 했지만, 일반적으로 생각하는 프론트엔드와 백엔드 분리가 아니었다는 점이다.

- FE 프로젝트: Spring Boot + Thymeleaf + Security 중심
- BE 프로젝트: Spring Boot + DB 접근 중심
- Batch: BE 프로젝트 내부의 스케줄 기능으로 동작

즉, 화면을 담당하는 Spring 서버가 있고, 실제 데이터 처리는 또 다른 Spring 서버를 호출하는 구조였다.  
처음 개발할 때는 빠르게 화면과 인증을 붙이고, DB 접근을 별도 서버로 넘기기 위한 선택이었을 수 있다. 하지만 유지보수 관점에서는 책임 경계가 애매했고, 요청 흐름도 불필요하게 길어졌다.

그래서 이번 개편의 방향은 단순히 코드를 예쁘게 정리하는 것이 아니라, **기능은 유지하되 런타임 책임을 다시 나누는 것**으로 잡았다.

---

## 기존 구조에서 느낀 문제

기존 구조를 단순화하면 다음과 같았다.

```text
Browser
  -> Spring FE 서버
      -> Spring BE 서버
          -> DB

Spring BE 서버
  -> Scheduler
  -> DB
```

이 구조의 가장 큰 문제는 `FE`라는 이름의 프로젝트가 실제로는 프론트엔드가 아니라 또 하나의 Spring 애플리케이션이었다는 점이다.

물론 서버 사이드 렌더링이 무조건 나쁜 것은 아니다. Thymeleaf를 사용하는 구조도 충분히 유효한 선택이 될 수 있다. 문제는 현재 서비스에서 화면 렌더링, 인증 처리, API 중계, 데이터 처리 책임이 어설프게 분산되어 있었다는 것이다.

이런 구조에서는 다음과 같은 비용이 계속 발생한다.

- 화면 요청이 Spring FE와 Spring BE를 모두 거쳐야 한다.
- 프론트 변경과 서버 변경의 경계가 흐려진다.
- 인증, 세션, API 호출 책임이 어디에 있는지 애매해진다.
- 장애가 났을 때 어느 서버의 문제인지 추적해야 할 범위가 넓어진다.
- Batch 작업이 API 서버와 같은 애플리케이션 안에서 실행되어 부하와 장애 영향 범위가 섞인다.

결국 현재 구조를 조금씩 고치는 것보다, 기능은 유지하면서 내부 구조를 다시 잡는 편이 장기적으로 더 낫다고 판단했다.

---

## 목표 구조

이번에 생각한 목표 구조는 다음과 같다.

```text
Browser
  -> React
  -> Spring API Server
      -> DB / Redis / External API

Spring Batch Server
  -> DB / External API
```

프론트엔드는 React로 분리하고, Spring은 API 서버 역할에 집중시킨다.  
그리고 기존 BE 서버 안에 들어 있던 스케줄/배치 기능은 별도의 Batch 애플리케이션으로 분리한다.

이렇게 하면 각 애플리케이션의 책임이 훨씬 명확해진다.

| 영역 | 책임 |
| --- | --- |
| React | 화면, 사용자 인터랙션, 클라이언트 상태 |
| API Server | 인증/인가, HTTP API, 비즈니스 유스케이스 실행 |
| Batch Server | 정기 작업, 대량 처리, 외부 연동 동기화 |
| DB | 영속 데이터 저장 |

React는 정적 리소스로 배포할 수 있고, API 서버는 사용자 요청 처리에 집중할 수 있다.  
Batch 서버는 사용자 요청과 무관하게 정해진 시간에 작업을 수행하거나, 필요할 때 독립적으로 실행할 수 있다.

---

## Batch를 분리하려는 이유

API 서버와 Batch 서버는 성격이 다르다.

API 서버는 사용자의 요청을 빠르게 받고 응답해야 한다. 반면 Batch는 보통 다음과 같은 일을 한다.

- 대량 데이터 집계
- 정산
- 알림 발송
- 외부 API 동기화
- 오래 걸리는 후처리
- 실패한 작업 재시도

이 작업들은 CPU, 메모리, DB 커넥션을 많이 사용할 수 있고, 실행 시간이 길어질 수도 있다.  
API 서버 안에서 Batch가 같이 돌면 Batch 부하가 API 응답 속도에 영향을 줄 수 있고, 반대로 API 서버 배포나 장애가 Batch 실행에도 영향을 줄 수 있다.

그래서 Batch는 별도 애플리케이션으로 분리하는 편이 더 낫다고 봤다.

```text
apps
  api
  batch
```

다만 Batch를 분리한다고 해서 모든 문제가 해결되는 것은 아니다. Batch는 보통 API 서버와 같은 DB를 바라보게 되므로 다음 사항을 별도로 설계해야 한다.

- 같은 Job이 중복 실행되지 않도록 제어하기
- 실패한 작업을 재시도할 수 있게 만들기
- 중간에 실패해도 다시 실행 가능한 구조로 만들기
- 같은 작업이 두 번 실행되어도 데이터가 망가지지 않도록 멱등성 보장하기
- 대량 처리 시 트랜잭션 범위와 락 범위 조절하기

단순한 스케줄 작업이라면 `@Scheduled`만으로 시작할 수도 있다.  
하지만 실행 이력, 재시작, 실패 관리, 대량 처리 단위가 중요해지는 순간에는 Spring Batch 도입을 같이 검토하는 것이 좋다.

---

## 멀티모듈을 고민한 이유

FE, API, Batch를 분리한다고 했을 때 백엔드를 완전히 다른 프로젝트로 나눌 수도 있다.  
예를 들면 API 서버 저장소와 Batch 서버 저장소를 따로 두는 방식이다.

하지만 이번 경우에는 처음부터 완전 분리된 저장소로 가는 것보다, 백엔드는 Gradle 멀티모듈로 구성하는 쪽이 더 현실적이라고 판단했다.

이유는 API와 Batch가 공유해야 할 코드가 많기 때문이다.

- 도메인 모델
- 비즈니스 규칙
- Repository
- 외부 API Client
- 공통 예외
- 공통 설정
- 테스트 픽스처

이것들을 각 프로젝트에 중복해서 만들면, 처음에는 편해 보여도 시간이 지나면서 수정 지점이 계속 늘어난다.  
반대로 공통 라이브러리를 별도로 만들어 배포하면 버전 관리와 배포 순서가 부담이 된다.

멀티모듈은 이 중간 지점에 있다.  
하나의 저장소와 빌드 안에서 여러 모듈을 나누고, 각 애플리케이션은 필요한 모듈만 의존하게 만든다.

Gradle 기준으로 멀티프로젝트 빌드는 루트 프로젝트와 하나 이상의 서브프로젝트로 구성되며, 보통 `settings.gradle` 또는 `settings.gradle.kts`에서 하위 프로젝트를 선언한다. 즉, 코드베이스는 함께 관리하지만 모듈의 책임과 의존성은 분리할 수 있다.

---

## 생각 중인 백엔드 구조

현재 생각하는 구조는 다음과 같다.

```text
backend/
  settings.gradle
  build.gradle

  apps/
    api/
      build.gradle
      src/main/java/...

    batch/
      build.gradle
      src/main/java/...

  modules/
    domain/
      build.gradle
      src/main/java/...

    application/
      build.gradle
      src/main/java/...

    infrastructure/
      build.gradle
      src/main/java/...

    common/
      build.gradle
      src/main/java/...
```

각 모듈의 역할은 대략 다음처럼 나눌 수 있다.

| 모듈 | 역할 |
| --- | --- |
| `apps:api` | Spring Boot API 실행 애플리케이션, Controller, Security, API 설정 |
| `apps:batch` | Spring Boot Batch/Scheduler 실행 애플리케이션, Job 설정 |
| `modules:domain` | Entity, 도메인 모델, 핵심 비즈니스 규칙 |
| `modules:application` | UseCase, Service, 트랜잭션 경계 |
| `modules:infrastructure` | JPA Repository, 외부 API Client, 파일/메일/Redis 연동 |
| `modules:common` | 공통 예외, 공통 응답, 유틸성 코드 |

의존성 방향은 단순하게 유지하려고 한다.

```text
apps:api
  -> modules:application
  -> modules:infrastructure

apps:batch
  -> modules:application
  -> modules:infrastructure

modules:application
  -> modules:domain
  -> modules:common

modules:infrastructure
  -> modules:domain
  -> modules:common

modules:domain
  -> modules:common
```

중요한 점은 `domain`이 `api`, `batch`, `infrastructure`를 몰라야 한다는 것이다.  
도메인 모듈은 최대한 순수하게 유지하고, Spring MVC, Security, JPA 구현체, 외부 API 호출 방식 같은 세부사항은 바깥쪽 모듈에서 다루는 편이 좋다.

---

## 너무 잘게 나누지는 않기

멀티모듈을 적용할 때 조심해야 할 점도 있다.  
모듈을 나누는 것 자체가 목적이 되면 오히려 구조가 더 복잡해진다.

처음부터 다음처럼 도메인별로 과하게 쪼개는 것은 아직 이르다고 본다.

```text
member-domain
order-domain
payment-domain
admin-domain
settlement-domain
notification-domain
...
```

서비스 규모가 크고 각 도메인의 경계가 명확하다면 이런 분리도 의미가 있다.  
하지만 기존 서비스를 재구성하는 단계에서는 먼저 큰 책임 기준으로 나누는 편이 더 안전하다.

처음에는 다음 정도로 시작하고,

```text
apps:api
apps:batch
modules:domain
modules:application
modules:infrastructure
modules:common
```

나중에 특정 도메인이 충분히 커지고 변경 주기가 달라지면 그때 도메인 단위 모듈 분리를 검토해도 늦지 않다.

---

## FE는 멀티모듈에 넣을까?

React 프로젝트까지 Gradle 멀티모듈 안에 넣을지는 조금 다르게 봐야 한다.

개인적으로는 FE와 BE를 같은 저장소에 둘 수는 있지만, React를 억지로 Gradle 멀티모듈의 하위 프로젝트로 넣고 싶지는 않다.

```text
repository/
  frontend/
  backend/
```

이 정도로 나누는 편이 더 자연스럽다.

프론트엔드는 Node, Vite, React 생태계의 빌드 흐름을 따르고, 백엔드는 Gradle과 Spring Boot의 빌드 흐름을 따르면 된다.  
같은 저장소에서 변경 이력을 함께 볼 수 있다는 장점은 가져가되, 빌드 도구와 실행 방식까지 억지로 하나로 묶지는 않는 것이다.

---

## 지금 단계의 결론

이번 개편에서 내가 잡은 방향은 다음과 같다.

1. 기존 Spring FE는 제거하고 React로 프론트엔드를 분리한다.
2. Spring BE는 API 서버 역할에 집중하도록 재구성한다.
3. 기존 BE 내부의 스케줄 기능은 Batch 애플리케이션으로 분리한다.
4. 백엔드는 Gradle 멀티모듈로 구성해 API와 Batch가 공통 도메인/인프라 코드를 공유한다.
5. 처음부터 과하게 모듈을 쪼개지 않고, `api`, `batch`, `domain`, `application`, `infrastructure`, `common` 정도로 시작한다.

아직 실제 마이그레이션 과정에서는 더 많은 문제가 나올 것이다.  
인증 방식, 기존 API 호환성, DB 스키마 유지 여부, 배치 실행 이력, 배포 파이프라인까지 같이 봐야 한다.

그래도 이번에 가장 먼저 정리해야 할 기준은 분명해졌다.

**화면, API, Batch는 런타임 책임이 다르다.**  
그리고 그 책임을 분리하되, 공통 비즈니스 코드는 멀티모듈로 재사용하는 방향이 지금 서비스에는 가장 현실적인 선택이라고 생각한다.

---

## Reference

- [Gradle User Manual - Multi-Project Builds](https://docs.gradle.org/current/userguide/multi_project_builds.html)
- [Spring Batch Reference Documentation](https://docs.spring.io/spring-batch/reference/index.html)
