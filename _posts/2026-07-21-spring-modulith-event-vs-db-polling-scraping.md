---
layout: post
title: "스크래핑 서비스 아키텍처 고민 - DB Polling vs Event-Driven, 그리고 Spring Modulith"
category: spring
tags: [spring, spring-modulith, architecture, scraping, event-driven]
published: false
---

Spring Modulith 기반으로 스크래핑 서류 수집 서비스를 구조화하면서 한 가지 고민에 빠졌다.  
수집 대상을 찾는 방식을 기존처럼 **DB Polling**으로 가져갈 것인가, 아니면 **이벤트 기반(Event-Driven)**으로 전환할 것인가에 대한 고민이었다.

처음에는 "이왕 Spring Modulith로 모듈 경계를 세우는 김에 이벤트로 싹 바꾸면 좋지 않을까?" 싶었지만, 막상 이벤트를 도입하려니 Kafka나 Redis 같은 외부 브로커 인프라를 구축해야 하는 부담과 메시지 유실에 대한 걱정이 앞섰다.

이 글은 소규모 스크래핑 서비스에서 DB Polling과 이벤트 방식을 고민했던 과정과, Spring Modulith가 제시하는 현실적인 해답을 정리한 기록이다.

---

## 1. DB Polling 방식의 한계와 고민

기존 서비스는 스케줄러가 주기적으로 DB 요청 테이블을 조회(`SELECT ... WHERE status = 'PENDING'`)하여 수집 대상 건을 찾고, 이를 자사 스크래핑 엔진이나 external API로 전달하는 구조였다.

DB Polling 방식은 구조가 단순하고 실패 시 재처리(`retry_count` 관리)가 쉽다는 장점이 있다.  
그러나 스크래핑 서비스 관점에서는 아래와 같은 문제점이 명확했다.

1. **실시간성 부족**: 클라이언트가 수집 요청을 보낸 뒤 다음 폴링 주기까지 무조건 대기해야 한다.
2. **DB I/O 부하**: 작업 건수가 없어도 주기적으로 SELECT 쿼리가 발생한다.
3. **스케줄러의 비대화**: 스케줄러가 수집 대상 조회, 세션 검증, 수집 요청, 파일 생성까지 전 과정을 알게 되어 모듈 간 결합도가 높아진다.

---

## 2. Event-Driven 전환 시 겪은 오해와 부담

"그럼 요청이 올 때 이벤트를 발행해서 즉시 처리하자!"라고 생각했을 때, 두 가지 현실적인 걸림돌이 있었다.

### 1) 외부 브로커(Kafka, RabbitMQ) 인프라 부담
보통 '이벤트 기반'이라고 하면 Kafka나 RabbitMQ 같은 메시지 브로커를 띄우는 그림을 떠올린다.  
하지만 현재 서비스는 규모가 작은 편인데, 이를 위해 별도의 큐 서버를 띄우고 모니터링 및 클러스터를 관리하는 것은 배보다 배꼽이 더 큰 인프라 오버헤드였다.

### 2) Redis의 유실 위험
인프라 부담을 줄이기 위해 그나마 가벼운 Redis를 고민해보기도 했다.  
그러나 Redis Pub/Sub은 기본적으로 메모리 기반 전달 방식이기 때문에, 수집 처리 중 서버가 다운되거나 장애가 발생하면 **요청 이벤트가 유실될 위험**이 존재했다. 서류 수집 서비스 특성상 요청 유실은 서비스 신뢰도와 직결되는 치명적인 문제였다.

### 3) 외부 기관 사이트의 Rate Limit (동시성 제한)
순수 이벤트 기반으로 요청이 들어오는 족족 즉시 스크래핑 요청을 날릴 경우, 사용자 요청이 폭주하면 홈택스나 금융사 같은 외부 대상 사이트에서 **IP 차단**이나 **타임아웃**을 유발할 수 있었다.

---

## 3. 반전: Spring Modulith의 Event Publication Registry

고민 끝에 찾은 해답은 **Spring Modulith가 제공하는 내장 이벤트 인프라**였다.

Spring Modulith는 Kafka나 Redis 같은 외부 브로커 없이도, 기존 RDBMS만을 활용해 **유실 없는 이벤트 전달(Transactional Outbox Pattern)**을 지원한다.

```text
[요청 모듈] --(publishEvent)--> [Spring Modulith Engine]
                                      │
                         ┌────────────┴────────────┐
                         ▼                         ▼
            [(동일 DB 트랜잭션)]           [이벤트 리스너 수신]
             EVENT_PUBLICATION 테이블에        (@ApplicationModuleListener)
             이벤트 자동 기록                     └─> 스크래핑 Task 등록
```

### 왜 이 방식이 소규모 서비스에 최적인가?

* **추가 인프라 0개**: Kafka/RabbitMQ/Redis를 띄울 필요 없이, 이미 사용 중인 RDBMS(PostgreSQL/MySQL 등)의 테이블 하나로 해결된다.
* **유실률 0% 보장**: 이벤트 발행이 비즈니스 로직과 동일한 DB 트랜잭션으로 묶인다. 수집 요청은 저장됐는데 이벤트가 날아가는 현상 자체가 불가능하다.
* **서버 다운 시 자동 재처리**: 처리 도중 서버가 꺼지더라도 `EVENT_PUBLICATION` 테이블에 미완료 이벤트로 남아있어, 서버 재시작 시 Spring Modulith가 알아서 감지하고 재처리해 준다.

---

## 4. 최종 선택: 이벤트 트리거 + Task Queue (하이브리드 아키텍처)

결국 스크래핑 서비스에는 **"이벤트(Event-Driven) 기반 모듈 분리 + Task Queue/Worker(Polling)"** 형태의 하이브리드 구조가 가장 적합하다는 결론을 내렸다.

```text
1. [클라이언트 요청] 
      │
2. [Collection Module] ──(Spring Modulith Event 발행)──> [Scraping Module]
                                                            │
3. [Scraping Task DB (PENDING) 저장] <──────────────────────┘
      │
4. [Scraping Worker / Poller]
      └─> Rate Limit 및 동시성을 제어하며 Task 인출 (SELECT ... FOR UPDATE SKIP LOCKED)
      └─> 외부 기관 스크래핑 실행
```

### 이 아키텍처의 장점
1. **모듈 결합도 분리**: 요청 모듈은 "수집이 필요하다"는 이벤트만 발행하고 스크래핑의 세부 구현을 알 필요가 없다.
2. **안전한 동시성 제어**: 스크래핑 Worker가 동시 요청 수를 제한하며 처리하므로 외부 사이트 차단을 방지할 수 있다.
3. **완벽한 안정성**: Spring Modulith의 Transactional Outbox 덕분에 이벤트 유실 우려가 없다.

---

## 요약 / 결론

1. 소규모 서비스에서 이벤트 기반 구조를 도입할 때 굳이 Kafka나 Redis 같은 외부 메시지 브로커를 띄울 필요는 없다.
2. Spring Modulith의 `EVENT_PUBLICATION` (Transactional Outbox)을 활용하면 기존 RDBMS만으로 메시지 유실 없는 안전한 이벤트를 구현할 수 있다.
3. 스크래핑 특성상 동시성 제어 및 재처리가 중요하므로, **Modulith 이벤트로 모듈을 결합 해제(Decouple)하고, 내부 처리는 Task Queue/Worker로 속도를 조절하는 하이브리드 방식**이 가장 안정적이다.

---

## Reference

- [Spring Modulith Reference - Working with Application Events](https://docs.spring.io/spring-modulith/reference/events.html)
- [Spring Modulith Reference - Event Publication Registry](https://docs.spring.io/spring-modulith/reference/events.html#publication-registry)
