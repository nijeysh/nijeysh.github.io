---
layout: post
title: "Spring Cache와 @Cacheable 어노테이션 알아보기"
category: tech
tags: [java, spring, cache]
---

이번 포스팅에서는 애플리케이션 성능 최적화의 핵심인 **캐싱(Caching)**과, 이를 스프링 환경에서 쉽게 도입할 수 있게 해주는 **Spring Cache** 및 `@Cacheable` 어노테이션에 대해 알아보겠습니다.

---

## 🚀 캐싱(Caching)이란 무엇일까?

캐싱은 데이터나 계산 결과를 미리 임시 저장소(캐시/Cache)에 저장해 두고, 나중에 같은 요청이 왔을 때 데이터베이스나 복잡한 연산을 거치지 않고 캐시에서 바로 꺼내어 응답 속도를 비약적으로 향상시키는 기법입니다.

### 주로 사용하는 캐싱 방식
캐싱은 데이터를 어디에 저장하냐에 따라 크게 두 가지로 나눌 수 있습니다.

1. **로컬 캐시 (Local Cache / In-Memory Cache)**
   - **설명**: 애플리케이션(JVM 등)이 실행되는 메모리(RAM) 내에 직접 데이터를 저장합니다.
   - **장점**: 같은 인스턴스 내에 존재하므로 네트워크 통신 비용이 발생하지 않아 속도가 가장 빠릅니다.
   - **단점**: 애플리케이션 인스턴스가 여러 개인 분산 환경에서는 각 서버마다 캐시 데이터가 달라 정합성(일관성) 문제가 발생할 수 있습니다. (예: Ehcache, Caffeine)

2. **글로벌 캐시 (Global Cache / Distributed Cache)**
   - **설명**: 애플리케이션과 별개의 외부 캐시 전용 서버를 구축하고, 여러 서버가 하나의 캐시 서버를 바라보는 방식입니다.
   - **장점**: 분산 환경에서도 단일한 캐시 저장소를 공유하므로 데이터 정합성이 보장됩니다.
   - **단점**: 별도의 서버 인프라가 필요하며, 네트워크를 통해 접근해야 하므로 로컬 캐시보다는 약간의 통신 지연이 발생합니다. (예: Redis, Memcached)

---

## 🍃 Spring Cache 추상화

스프링(Spring)은 특정 캐시 라이브러리(Ehcache, Redis, Caffeine 등)에 강하게 종속되는 것을 막기 위해 **Cache Abstraction(캐시 추상화)** 기능을 제공합니다. 

개발자는 스프링이 제공하는 공통 인터페이스와 어노테이션 기반으로 코드를 작성하고, 캐시 저장소 구현체는 설정(`application.yml` 등)만 변경하여 언제든 갈아끼울 수 있습니다.

---

## 💻 @Cacheable 어노테이션

Spring Cache에서 제공하는 여러 어노테이션 중 가장 핵심적이고 자주 쓰이는 것이 바로 `@Cacheable`입니다. 이 어노테이션은 **메소드의 반환값을 캐시에 저장**하고, 같은 파라미터로 다시 호출될 때는 **메서드를 실행하지 않고 캐시에서 값을 반환**합니다.

### 사용 방법

먼저 스프링 부트 설정 클래스에 `@EnableCaching`을 추가하여 캐시 기능을 활성화해야 합니다.

```java
import org.springframework.cache.annotation.EnableCaching;
import org.springframework.context.annotation.Configuration;

@EnableCaching
@Configuration
public class CacheConfig {
    // 캐시 매니저 설정 시 추가 (Redis, ConcurrentMap 등)
}
```

이제 캐싱을 적용할 대상 메서드에 `@Cacheable`을 붙여줍니다.

```java
import org.springframework.cache.annotation.Cacheable;
import org.springframework.stereotype.Service;

@Service
public class UserService {

    private final UserRepository userRepository;

    public UserService(UserRepository userRepository) {
        this.userRepository = userRepository;
    }

    // 캐시 이름은 'users', 입력 파라미터 userId를 캐시 키(Key)로 사용
    @Cacheable(value = "users", key = "#userId")
    public User getUserById(Long userId) {
        // 이 부분은 캐시에 데이터가 없을 때만 실행됩니다.
        System.out.println("데이터베이스에서 조회합니다: " + userId);
        return userRepository.findById(userId).orElseThrow();
    }
}
```

위 로직을 실행하면:
1. `getUserById(1L)` 최초 호출: 메서드 실행 -> 로직에 따라 DB 조회 후 결과 반환 -> **결과물을 'users' 캐시 저장소에 키 '1'로 저장**
2. `getUserById(1L)` 두 번째 호출: 메서드 로직 아예 실행 안 됨 -> **캐시에서 키 '1'에 해당하는 값을 바로 꺼내 반환**

---

## ⚖️ 캐시 도입의 장단점

캐시는 강력하지만 무작정 적용해야 하는 은탄환은 아닙니다. 장단점을 고려해 도입을 결정해야 합니다.

### 장점 (Pros)
1. **응답 속도 대폭 향상**: DB I/O나 비싼 연산 과정을 스킵하므로 서비스 응답 시간이 빨라집니다.
2. **시스템 부하 감소**: 메인 데이터베이스나 외부 API로 향하는 트래픽이 줄어들어 시스템 인프라 전반의 안정성이 높아집니다.
3. **확장성 확보**: 읽기 트래픽이 몰리는 대용량 서비스 환경을 지탱하는 핵심 역할을 합니다.

### 단점 (Cons)
1. **데이터 정합성 문제 관리 (가장 큰 이슈)**: 실제 원본 데이터(DB)는 변경되었는데 사용자에게는 캐시된 과거의 낡은(Stale) 데이터가 노출될 수 있습니다. 이를 방지하기 위한 캐시 만료(TTL) 정책이나 데이터 갱신/삭제 로직(`@CachePut`, `@CacheEvict`)을 꼼꼼하게 설계해야 합니다.
2. **복잡도 증가**: 시스템 아키텍처에 캐시 계층이 추가됨으로써 디버깅이 어려워지고, 운영해야 할 컴포넌트(예: Redis 서버)가 늘어납니다.
3. **메모리 자원 낭비 우려**: 모든 데이터를 다 캐시에 올리면 한정적인 메모리가 금방 고갈됩니다. 정말 자주 조회되고 잘 변하지 않는 데이터만 선별하여 캐싱해야 합니다.

---

### 마치며

이번 글에서는 스프링 환경에서 성능의 핵심인 캐시를 쉽고 강력하게 다룰 수 있는 Spring Cache와 `@Cacheable` 어노테이션에 대해 알아보았습니다. 빈번하게 조회되지만 잘 변하지 않는 핵심 도메인이 있다면 올바른 캐시 정책을 세워 서비스 성능을 한 층 더 끌어올려 보시기 바랍니다!
