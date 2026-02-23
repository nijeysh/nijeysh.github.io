---
layout: post
title: "Spring Boot 시작하기 - 프로젝트 구조 이해"
date: 2025-02-09
tags: [spring, java]
---

Spring Boot를 처음 접할 때 가장 먼저 이해해야 할 것은 프로젝트 구조입니다.

## 기본 디렉토리 구조

```
src/
├── main/
│   ├── java/com/example/demo/
│   │   ├── DemoApplication.java   ← 진입점
│   │   ├── controller/
│   │   ├── service/
│   │   ├── repository/
│   │   └── entity/
│   └── resources/
│       ├── application.yml        ← 설정 파일
│       ├── static/                ← 정적 파일
│       └── templates/             ← 템플릿 (Thymeleaf 등)
└── test/
    └── java/com/example/demo/
```

## @SpringBootApplication

```java
@SpringBootApplication  // @Configuration + @EnableAutoConfiguration + @ComponentScan
public class DemoApplication {
    public static void main(String[] args) {
        SpringApplication.run(DemoApplication.class, args);
    }
}
```

`@SpringBootApplication`은 세 가지 어노테이션의 조합으로, auto-configuration과 컴포넌트 스캔을 자동으로 처리합니다.
