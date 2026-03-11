---
layout: post
title: "Spring Self-Injection — 같은 서비스 내에서 AOP(@Async, @Transactional 등)를 적용하는 방법"
date: 2026-03-11
category: tech
tags: [java, spring, aop, async]
---

같은 서비스 내에서 `@Async` 메서드를 호출했는데 비동기로 동작하지 않는 문제를 겪으면서 **Self-Injection**이라는 패턴을 알게 되었습니다. 결국 제가 선택한 해결 방법은 **서비스 분리**였지만, Self-Injection이라는 개념 자체가 흥미롭고 유용한 상황이 있어 정리 차원에서 블로그 글로 남깁니다.

---

## 🤔 문제 상황: 같은 서비스 내 @Async 호출이 동기로 실행된다?

아래와 같은 코드를 작성했다고 가정합니다.

```java
@Service
public class OrderService {

    public void placeOrder(Order order) {
        // 주문 처리 로직
        saveOrder(order);

        // 알림 전송을 비동기로 처리하고 싶다!
        sendNotification(order);
    }

    @Async
    public void sendNotification(Order order) {
        // 시간이 오래 걸리는 알림 전송 로직
        System.out.println("알림 전송 시작 - Thread: " + Thread.currentThread().getName());
        // ...
    }

    private void saveOrder(Order order) {
        // DB 저장 로직
    }
}
```

`sendNotification()`에 `@Async`를 붙였으니 비동기로 실행될 것 같지만, **실제로는 동기로 실행됩니다.**

왜 그럴까요?

---

## 📖 원인: Spring AOP의 프록시 메커니즘

Spring의 `@Async`, `@Transactional`, `@Cacheable` 같은 어노테이션들은 **AOP(Aspect-Oriented Programming)** 기반으로 동작합니다. Spring은 빈(Bean)을 생성할 때 **프록시 객체**를 감싸서 등록하는데, 외부에서 해당 빈의 메서드를 호출하면 프록시를 거쳐 AOP가 적용됩니다.

하지만 **같은 클래스 내부에서 `this.method()`로 호출하면 프록시를 거치지 않고 직접 호출되기 때문에 AOP가 적용되지 않습니다.**

```
[외부 호출] → Proxy → AOP 적용 → 실제 메서드 ✅ AOP 동작
[내부 호출] → this.method() → 실제 메서드    ❌ AOP 무시
```

이것이 바로 **Self-Invocation 문제**입니다.

> 💡 `@Transactional`도 마찬가지입니다. 같은 서비스 내에서 `this.method()`로 호출하면 트랜잭션이 적용되지 않습니다.

---

## 💉 해결 방법 1: Self-Injection (`@Lazy` + `@Autowired`)

**Self-Injection**이란 빈이 자기 자신을 주입받는 패턴입니다. 자기 자신의 **프록시 객체**를 주입받아서, 내부 호출 시에도 프록시를 통해 AOP가 적용되도록 합니다.

### 코드 예시

```java
@Service
public class OrderService {

    @Lazy
    @Autowired
    private OrderService self;

    public void placeOrder(Order order) {
        saveOrder(order);

        // this 대신 self(프록시)를 통해 호출 → AOP 적용됨!
        self.sendNotification(order);
    }

    @Async
    public void sendNotification(Order order) {
        System.out.println("알림 전송 시작 - Thread: " + Thread.currentThread().getName());
        // ...
    }

    private void saveOrder(Order order) {
        // DB 저장 로직
    }
}
```

### 왜 `@Lazy`가 필요한가?

`@Autowired`만 사용하면 **순환 참조(Circular Dependency)** 문제가 발생합니다. `OrderService`를 생성하려면 `OrderService`가 필요한데, 아직 생성이 끝나지 않았으니 주입할 수 없는 상황이 됩니다.

`@Lazy`를 붙이면 **빈 생성 시점에 실제 객체 대신 프록시를 주입**하고, 실제 사용 시점에 프록시가 실제 빈을 찾아 위임합니다. 이로써 순환 참조 문제를 우회할 수 있습니다.

```
Bean 생성 시 → @Lazy 프록시 주입 (실제 빈 아직 필요 없음)
메서드 호출 시 → 프록시가 실제 빈을 찾아서 위임 → AOP 적용됨
```

---

## 🔧 해결 방법 2: 서비스 분리 (권장)

Self-Injection은 편리하지만, 가장 깔끔한 방법은 **비동기 로직을 별도 서비스로 분리**하는 것입니다. 외부 빈에서 호출하면 자연스럽게 프록시를 거치므로 AOP가 정상 적용됩니다.

```java
@Service
public class OrderService {

    private final NotificationService notificationService;

    public OrderService(NotificationService notificationService) {
        this.notificationService = notificationService;
    }

    public void placeOrder(Order order) {
        saveOrder(order);
        notificationService.sendNotification(order); // 외부 빈 호출 → AOP 적용됨
    }

    private void saveOrder(Order order) {
        // DB 저장 로직
    }
}

@Service
public class NotificationService {

    @Async
    public void sendNotification(Order order) {
        System.out.println("알림 전송 시작 - Thread: " + Thread.currentThread().getName());
        // ...
    }
}
```

> 💡 저도 이 방식으로 해결했습니다. 서비스 분리는 **단일 책임 원칙(SRP)**에도 부합하고, 코드의 가독성과 테스트 용이성도 높아집니다.

---

## 📋 Self-Injection이 유용한 경우

그렇다면 Self-Injection은 언제 쓸까요? 서비스 분리가 **부자연스럽거나 과도한 경우**에 유용합니다.

| 상황 | 설명 |
|------|------|
| 트랜잭션 전파 제어 | 같은 서비스에서 `@Transactional(propagation = REQUIRES_NEW)` 메서드를 호출해야 할 때 |
| 캐시 적용 | 같은 서비스 내에서 `@Cacheable` 메서드를 호출해야 할 때 |
| 레거시 코드 대응 | 코드 분리가 어려운 기존 코드에서 빠르게 AOP를 적용해야 할 때 |

### 트랜잭션 Self-Injection 예시

```java
@Service
public class AccountService {

    @Lazy
    @Autowired
    private AccountService self;

    @Transactional
    public void transfer(Long fromId, Long toId, BigDecimal amount) {
        withdraw(fromId, amount);

        // 독립적인 트랜잭션으로 입금 기록을 남기고 싶을 때
        self.recordTransferLog(fromId, toId, amount);
    }

    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void recordTransferLog(Long fromId, Long toId, BigDecimal amount) {
        // 별도 트랜잭션으로 로그 기록
        // 메인 트랜잭션이 실패해도 이 로그는 커밋됨
    }

    private void withdraw(Long accountId, BigDecimal amount) {
        // 출금 로직
    }
}
```

---

## 🔗 Spring 공식 문서 참고

Spring 공식 문서에서도 Self-Invocation 문제와 해결 방법에 대해 언급하고 있습니다.

- **Spring AOP — Self-Invocation 이해하기**  
  [Understanding AOP Proxies](https://docs.spring.io/spring-framework/reference/core/aop/proxying.html#aop-understanding-aop-proxies)  
  — 같은 객체 내부에서의 메서드 호출 시 프록시를 거치지 않는 문제를 설명

- **@Lazy 어노테이션 API 문서**  
  [Lazy (Spring Framework API)](https://docs.spring.io/spring-framework/docs/current/javadoc-api/org/springframework/context/annotation/Lazy.html)  
  — 주입 시점에 `@Lazy`를 사용하면 lazy-resolution proxy를 주입한다는 내용

- **@Async 사용 가이드**  
  [Asynchronous Execution](https://docs.spring.io/spring-framework/reference/integration/scheduling.html#scheduling-annotation-support-async)  
  — `@Async`의 프록시 기반 동작 방식 설명

---

## ⚠️ Self-Injection 사용 시 주의사항

1. **`@Lazy` 필수**: `@Lazy` 없이 자기 자신을 주입하면 순환 참조 에러 발생
2. **메서드 접근 제한자**: AOP가 적용되려면 메서드가 `public`이어야 합니다 (`private` 메서드에는 프록시가 개입할 수 없음)
3. **코드 가독성**: `self.method()` 호출이 다른 개발자에게 혼란을 줄 수 있으므로, 주석이나 팀 컨벤션으로 의도를 명확히 해야 합니다
4. **가능하면 서비스 분리를 우선 고려**: Self-Injection은 편의 수단이지, 설계적으로 더 나은 방법은 책임 분리입니다

---

## 마무리

정리하면:

1. Spring AOP 기반 어노테이션(`@Async`, `@Transactional`, `@Cacheable` 등)은 **프록시를 통해 동작**
2. 같은 클래스 내부에서 `this.method()`로 호출하면 **프록시를 우회하여 AOP가 적용되지 않음**
3. **Self-Injection** (`@Lazy @Autowired private MyService self`)으로 자기 자신의 프록시를 주입받아 해결 가능
4. 하지만 **서비스 분리가 가능하다면 그것이 더 깔끔한 설계**

이번에 `@Async`를 같은 서비스에서 호출하면서 비동기가 동작하지 않는 문제를 겪었고, 원인을 찾는 과정에서 Self-Injection 패턴을 알게 되었습니다. 저는 결국 서비스 분리로 해결했지만, Self-Injection이라는 기법 자체가 Spring AOP의 동작 원리를 이해하는 데 좋은 학습이 되었습니다.
