---
layout: post
title: "Java 컬렉션 프레임워크 정리"
date: 2025-01-12
tags: [java]
---

Java의 컬렉션 프레임워크는 데이터를 효율적으로 저장하고 조작하기 위한 클래스와 인터페이스 모음입니다.

## 주요 인터페이스

| 인터페이스 | 구현체 | 특징 |
|-----------|--------|------|
| `List` | `ArrayList`, `LinkedList` | 순서 O, 중복 O |
| `Set` | `HashSet`, `TreeSet`, `LinkedHashSet` | 순서 X, 중복 X |
| `Map` | `HashMap`, `TreeMap`, `LinkedHashMap` | Key-Value 쌍 |
| `Queue` | `LinkedList`, `PriorityQueue` | FIFO |

## ArrayList vs LinkedList

**ArrayList**는 내부적으로 배열을 사용하므로 인덱스 접근(O(1))이 빠르지만, 삽입/삭제 시 요소 이동이 필요해 중간 삽입이 느립니다(O(n)).

**LinkedList**는 노드 기반 구조로 삽입/삭제(O(1))가 빠르지만, 인덱스 접근이 느립니다(O(n)).

```java
List<String> arrayList  = new ArrayList<>();
List<String> linkedList = new LinkedList<>();
```
