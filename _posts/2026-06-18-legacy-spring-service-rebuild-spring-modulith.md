---
layout: post
title: "레거시 Spring 서비스 재구성하기 - 멀티모듈 대신 Spring Modulith"
date: 2026-06-18
category: spring
tags: [spring, architecture, spring-modulith, batch, react]
published: false
---

3년 전에 런칭된 서비스를 유지보수하게 되었다.  
서비스는 돌아가고 있었지만, 코드를 열어볼수록 "이걸 계속 고쳐가면서 쓰는 게 맞나?"라는 생각이 들었다.

기능 하나를 추가하려고 해도 어디까지 건드려야 하는지 바로 보이지 않았고, 장애가 나면 원인을 따라가는 과정도 꽤 피곤했다.  
처음 개발할 당시에는 일정이나 상황 때문에 어쩔 수 없는 선택들이 있었겠지만, 지금 유지보수를 맡은 입장에서는 이 구조를 그대로 끌고 가는 비용이 더 커 보였다.

그래서 처음에는 아예 프로젝트를 갈아엎고, 기능만 유지한 채 내부 구조를 다시 잡는 방향을 생각했다.

---

## 기존 구조

기존 프로젝트는 이름상으로는 `FE`와 `BE`가 나뉘어 있었다.

그런데 보통 말하는 프론트엔드와 백엔드 분리가 아니었다.

- FE 프로젝트: Spring Boot + Thymeleaf + Security
- BE 프로젝트: Spring Boot + DB 접근
- Batch: BE 프로젝트 내부 스케줄 기능

즉, FE도 Spring이고 BE도 Spring이었다.  
FE 프로젝트는 화면을 렌더링하고 인증을 처리하고, 실제 데이터가 필요하면 BE 프로젝트를 호출하는 식이었다.

단순화하면 이런 구조다.

```text
Browser
  -> Spring FE
      -> Spring BE
          -> DB

Spring BE
  -> Scheduler
  -> DB
```

처음 봤을 때는 "아 FE/BE를 나누긴 했구나" 싶었는데, 자세히 보면 프론트와 백엔드를 나눴다기보다는 Spring 서버를 두 개로 쪼개놓은 형태에 가까웠다.

물론 Thymeleaf나 서버 사이드 렌더링 자체가 문제라는 뜻은 아니다.  
문제는 이 서비스에서는 화면, 인증, API 중계, DB 처리, 스케줄 작업의 책임이 애매하게 흩어져 있었다는 점이다.

이런 구조에서는 변경 비용이 계속 커진다.

- 화면 변경인데 Spring FE를 봐야 한다.
- 데이터 변경인데 Spring FE와 Spring BE의 호출 흐름을 같이 봐야 한다.
- 인증 책임이 어디까지 FE에 있고 어디부터 BE에 있는지 애매하다.
- 요청이 서버를 한 번 더 거치면서 장애 지점이 늘어난다.
- Batch가 BE 안에 같이 있어서 API와 배치의 부하가 섞인다.

그래서 기존 구조를 조금씩 고치는 것보다, 책임을 다시 나누는 게 맞다고 봤다.

---

## 처음 생각했던 방향

처음에는 이렇게 생각했다.

```text
repository/
  frontend/     # React

  backend/
    apps/
      api/
      batch/

    modules/
      domain/
      application/
      infrastructure/
      common/
```

프론트는 React로 빼고, 백엔드는 Gradle 멀티모듈로 구성하는 방식이다.  
API 서버와 Batch 서버를 각각 실행 애플리케이션으로 두고, 공통 도메인이나 인프라 코드는 모듈로 공유하면 깔끔해 보였다.

이 방식이 틀렸다고 생각하지는 않는다.  
API와 Batch가 진짜로 배포 단위부터 다르고, 공통 코드도 어느 정도 안정되어 있다면 충분히 괜찮은 선택이다.

그런데 다시 생각해보니 지금 우리 상황에서는 바로 멀티모듈로 가는 게 조금 부담스러웠다.

---

## 멀티모듈이 애매했던 이유

멀티모듈은 코드를 물리적으로 나누는 방식이다.  
Gradle 프로젝트 단위가 나뉘고, 각 모듈의 의존성을 빌드 레벨에서 관리한다.

이게 장점이기도 하지만, 레거시를 재구성하는 초반에는 부담이 될 수도 있다.

아직 도메인 경계가 명확하지 않은 상태에서 모듈부터 나눠버리면 이런 일이 생긴다.

- 이 코드가 어느 모듈에 있어야 하는지 계속 고민하게 된다.
- 공통 모듈이 점점 커질 수 있다.
- 모듈 간 의존성이 생각보다 빨리 꼬일 수 있다.
- 구조를 바꾸는 비용이 빌드 구조 변경 비용까지 같이 커진다.
- 실제 문제는 패키지 의존성인데, 해결책은 프로젝트 분리로 과해질 수 있다.

특히 지금 서비스는 "이미 도메인이 잘 나뉘어 있는데 빌드만 정리하면 되는 상태"가 아니다.  
오히려 먼저 해야 할 일은 도메인과 기능 경계를 찾는 것이다.

그래서 멀티모듈보다 먼저 Spring Modulith를 적용하는 쪽으로 생각이 바뀌었다.

---

## Spring Modulith로 가려는 이유

Spring Modulith는 한 Spring Boot 애플리케이션 안에서 애플리케이션 모듈을 나누고, 그 경계를 검증할 수 있게 도와주는 도구다.

내가 좋게 본 지점은 이거다.

**물리적으로 프로젝트를 쪼개기 전에, 논리적인 모듈 경계를 먼저 세울 수 있다.**

즉, 처음부터 `api`, `batch`, `domain`, `application`, `infrastructure` 같은 Gradle 모듈을 만드는 대신, 하나의 Spring Boot 프로젝트 안에서 패키지 기준으로 기능 모듈을 나눈다.

예를 들면 이런 식이다.

```text
src/main/java/com/example/service/
  Application.java

  member/
    MemberService.java
    MemberRepository.java
    internal/
      MemberValidator.java

  order/
    OrderService.java
    OrderRepository.java
    internal/
      OrderPolicy.java

  payment/
    PaymentService.java
    PaymentRepository.java
    internal/
      PaymentClient.java

  notification/
    NotificationService.java
    internal/
      NotificationSender.java
```

Spring Modulith는 기본적으로 Spring Boot 애플리케이션의 메인 패키지 아래 직접 하위 패키지를 애플리케이션 모듈로 본다.  
위 구조라면 `member`, `order`, `payment`, `notification`이 각각 모듈이 된다.

각 모듈은 외부에 공개할 API와 내부 구현을 구분한다.  
예를 들어 `order` 모듈 밖에서는 `order.internal`에 직접 접근하지 않는 식으로 경계를 잡을 수 있다.

이게 좋은 이유는 단순하다.

코드를 한 프로젝트 안에 두면서도, "아무 데서나 아무 클래스나 가져다 쓰는 구조"를 막을 수 있기 때문이다.

---

## 내가 원하는 구조

현재 기준으로는 이렇게 가는 게 더 현실적이라고 본다.

```text
repository/
  frontend/       # React

  backend/        # Spring Boot + Spring Modulith
    src/main/java/...
```

런타임 기준으로는 다음처럼 나눈다.

```text
Browser
  -> React
  -> Spring API
      -> DB / Redis / External API
```

그리고 백엔드 내부는 Spring Modulith 기준으로 기능 모듈을 나눈다.

```text
backend
  member
  order
  payment
  notification
  settlement
```

이렇게 하면 당장 얻을 수 있는 장점이 있다.

- 배포 단위는 단순하게 유지할 수 있다.
- 패키지 구조만으로도 기능 경계를 드러낼 수 있다.
- 모듈 간 잘못된 의존성을 테스트로 잡을 수 있다.
- 나중에 진짜 분리해야 할 모듈이 보이면 그때 멀티모듈이나 별도 서비스로 뺄 수 있다.
- 레거시를 한 번에 크게 쪼개는 부담을 줄일 수 있다.

처음부터 멀티모듈을 만들면 구조가 좋아지는 것처럼 보일 수 있다.  
하지만 모듈 경계가 애매한 상태에서는 멀티모듈도 결국 복잡한 폴더 나누기가 될 수 있다.

지금은 "빌드 모듈을 나누는 것"보다 "업무 기능의 경계를 찾는 것"이 먼저라고 생각했다.

---

## 모듈 검증을 테스트로 잡기

Spring Modulith에서 가장 기대하는 부분은 구조 검증이다.

예를 들어 테스트에서 이런 식으로 애플리케이션 모듈 구조를 검증할 수 있다.

```java
import org.junit.jupiter.api.Test;
import org.springframework.modulith.core.ApplicationModules;

class ModularityTests {

    @Test
    void verifiesModularStructure() {
        ApplicationModules.of(Application.class).verify();
    }
}
```

이 테스트는 모듈 간 순환 참조가 있는지, 다른 모듈의 내부 패키지를 침범하고 있지는 않은지 등을 확인한다.

레거시 코드에서 가장 무서운 건 사실 "지금은 돌아가는데 왜 돌아가는지 모르는 상태"라고 생각한다.  
이런 검증 테스트가 있으면 최소한 구조가 망가지고 있는지 아닌지를 계속 확인할 수 있다.

내가 원하는 건 거창한 아키텍처 선언이 아니다.  
앞으로 코드를 고칠 때 "이 방향으로 가면 안 된다"를 자동으로 잡아주는 안전장치가 필요하다.

---

## 모듈 간 직접 호출을 줄이기

Spring Modulith를 보면서 또 괜찮다고 느낀 부분은 이벤트 기반 모듈 통신이다.

기존 코드는 보통 이런 식으로 흐르기 쉽다.

```java
@Service
public class OrderService {

    private final PaymentService paymentService;
    private final NotificationService notificationService;

    public void completeOrder(Long orderId) {
        // 주문 완료 처리
        paymentService.pay(orderId);
        notificationService.send(orderId);
    }
}
```

처음에는 별문제 없어 보인다.  
그런데 시간이 지나면 `OrderService`가 결제도 알고, 알림도 알고, 정산도 알고, 쿠폰도 알고, 계속 뭔가를 더 많이 알게 된다.

이러면 주문 모듈이 다른 모듈을 계속 끌어안게 된다.

Spring Modulith에서는 이런 흐름을 이벤트로 바꿔볼 수 있다.

```java
@Service
public class OrderService {

    private final ApplicationEventPublisher events;

    public void completeOrder(Long orderId) {
        // 주문 완료 처리
        events.publishEvent(new OrderCompletedEvent(orderId));
    }
}
```

그리고 결제나 알림 쪽에서 필요한 이벤트를 듣는다.

```java
@Component
public class NotificationEventHandler {

    @ApplicationModuleListener
    void on(OrderCompletedEvent event) {
        // 주문 완료 알림 처리
    }
}
```

이렇게 하면 주문 모듈은 "주문이 완료됐다"는 사실만 발행하고, 그 이후에 무엇을 할지는 각 모듈이 가져갈 수 있다.

물론 모든 걸 이벤트로 바꾸겠다는 뜻은 아니다.  
강한 일관성이 필요한 흐름은 직접 호출이 더 나을 수도 있다. 다만 부가 기능이나 후처리는 이벤트로 분리하는 게 유지보수에는 더 좋아 보인다.

---

## Batch는 어떻게 할까

처음에는 Batch를 API 서버와 완전히 다른 애플리케이션으로 빼려고 했다.

이 생각은 아직도 유효하다.  
대량 처리, 정산, 통계, 외부 API 동기화처럼 API 요청과 성격이 완전히 다른 작업은 분리하는 게 맞다.

다만 지금은 순서를 조금 바꿔보려고 한다.

1. 먼저 API 서버 내부를 Spring Modulith 기준으로 정리한다.
2. Batch 성격의 기능을 별도 모듈로 격리한다.
3. 실제 부하나 배포 요구가 명확해지면 Batch 애플리케이션으로 분리한다.

즉, 처음부터 Batch 프로젝트를 따로 만들기보다 `settlement`, `notification`, `sync` 같은 기능 모듈을 먼저 분리한다.  
그리고 그 안에서 스케줄 작업이 어디까지 커지는지 본다.

만약 Batch가 API 서버 리소스를 많이 잡아먹거나, 배포 주기가 달라지거나, 실패 재처리와 실행 이력 관리가 중요해지면 그때 Spring Batch 기반의 별도 애플리케이션으로 빼면 된다.

지금 중요한 건 "배치를 무조건 한 곳에 둔다"가 아니라, Batch 성격의 코드가 API 흐름에 섞이지 않게 만드는 것이다.

---

## 멀티모듈을 버린 건 아니다

멀티모듈을 아예 안 쓰겠다는 뜻은 아니다.

다만 지금 단계에서는 순서가 바뀐 것이다.

```text
1단계: Spring Modulith로 기능 경계 잡기
2단계: 모듈 간 의존성 검증하기
3단계: 이벤트로 느슨하게 연결할 부분 분리하기
4단계: 진짜 분리해야 하는 모듈이 보이면 멀티모듈 또는 별도 애플리케이션으로 분리하기
```

이렇게 가는 편이 레거시 개편에는 더 안전해 보인다.

처음부터 프로젝트를 크게 쪼개면 겉으로는 아키텍처가 좋아진 것처럼 보일 수 있다.  
하지만 실제로는 기존 꼬임을 여러 모듈에 나눠 담는 것에 그칠 수도 있다.

나는 이번에는 먼저 내부 경계를 찾고 싶다.  
그리고 그 경계가 어느 정도 검증되면, 그때 물리적인 분리를 고민하는 게 맞다고 생각한다.

---

## 지금 단계의 결론

이번 개편 방향을 다시 정리하면 이렇다.

1. 기존 Spring FE는 걷어내고 React로 프론트엔드를 분리한다.
2. 백엔드는 우선 하나의 Spring Boot 애플리케이션으로 단순하게 가져간다.
3. 내부 구조는 Spring Modulith로 기능 모듈을 나눈다.
4. 모듈 간 의존성은 테스트로 검증한다.
5. 후처리나 부가 기능은 이벤트 기반으로 분리한다.
6. Batch는 먼저 모듈로 격리하고, 필요성이 명확해지면 별도 애플리케이션으로 뺀다.
7. 멀티모듈은 당장 적용하지 않고, 나중에 물리적 분리가 필요해졌을 때 다시 검토한다.

결국 내가 하고 싶은 건 단순하다.

**한 번에 완벽한 구조를 만드는 게 아니라, 더 망가지기 어려운 구조로 바꾸는 것.**

레거시를 개편할 때 제일 위험한 건 너무 큰 그림부터 잡고 한 번에 다 바꾸려고 하는 거라고 생각한다.  
이번에는 Spring Modulith로 내부 경계를 먼저 세우고, 그 경계가 실제 코드에서 버티는지 확인하면서 다음 단계를 정하려고 한다.

---

## Reference

- [Spring Modulith Reference Documentation](https://docs.spring.io/spring-modulith/reference/)
- [Spring Modulith - Fundamentals](https://docs.spring.io/spring-modulith/reference/fundamentals.html)
- [Spring Modulith - Verifying Application Module Structure](https://docs.spring.io/spring-modulith/reference/verification.html)
- [Spring Modulith - Working with Application Events](https://docs.spring.io/spring-modulith/reference/events.html)
