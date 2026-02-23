---
layout: post
title: "Spring Data JPA 기초 - Repository 패턴"
date: 2025-02-16
tags: [spring, java]
---

Spring Data JPA를 사용하면 반복적인 CRUD 코드를 최소화할 수 있습니다.

## Entity 정의

```java
@Entity
@Table(name = "users")
public class User {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false)
    private String username;

    private String email;
    // getter, setter ...
}
```

## Repository 인터페이스

```java
public interface UserRepository extends JpaRepository<User, Long> {
    // 메서드 이름으로 쿼리 자동 생성
    Optional<User> findByUsername(String username);
    List<User> findByEmailContaining(String keyword);

    // JPQL 직접 작성
    @Query("SELECT u FROM User u WHERE u.username = :name")
    User findByName(@Param("name") String name);
}
```

`JpaRepository`를 상속하면 `save()`, `findById()`, `findAll()`, `deleteById()` 등의 기본 메서드가 자동으로 제공됩니다.
