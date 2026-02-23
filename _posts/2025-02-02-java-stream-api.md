---
layout: post
title: "Java 스트림(Stream) API 활용법"
date: 2025-01-26
tags: [java]
---

Java 8에서 도입된 Stream API는 컬렉션 데이터를 함수형 스타일로 처리할 수 있게 해줍니다.

## 기본 구조

```java
List<String> names = List.of("Alice", "Bob", "Charlie", "Dave");

// filter → map → collect
List<String> result = names.stream()
    .filter(n -> n.length() > 3)
    .map(String::toUpperCase)
    .sorted()
    .collect(Collectors.toList());
// ["ALICE", "CHARLIE", "DAVE"]
```

## 주요 중간 연산

- `filter(Predicate)` : 조건에 맞는 요소만 통과
- `map(Function)` : 각 요소를 다른 타입으로 변환
- `flatMap(Function)` : 중첩 스트림을 평탄화
- `sorted()` / `sorted(Comparator)` : 정렬
- `distinct()` : 중복 제거
- `limit(n)` / `skip(n)` : 개수 제한 / 건너뛰기

## 최종 연산

```java
long count  = stream.count();
Optional<T> first = stream.findFirst();
boolean     any   = stream.anyMatch(predicate);
List<T>     list  = stream.collect(Collectors.toList());
```
