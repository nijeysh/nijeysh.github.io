---
layout: post
title: "정렬 - 가장 큰 수 문제 풀이와 Java Comparator 정리"
date: 2026-03-03
category: algorithm
tags: [algorithm, programmers, java, sorting]
---

프로그래머스 [가장 큰 수](https://school.programmers.co.kr/learn/courses/30/lessons/42746) 문제를 풀면서 겪었던 사고 과정과, 그 과정에서 약하다고 느꼈던 Java의 `Comparator` / `Comparable`을 함께 정리합니다.

---

## 문제 요약

> 0 또는 양의 정수가 주어졌을 때, 정수를 이어 붙여 만들 수 있는 **가장 큰 수**를 구하라.

**예시:**  
- 입력: `[6, 10, 2]`  
- 가능한 조합: `6102`, `6210`, `1062`, `1026`, `2610`, `2106`  
- 정답: `"6210"`

---

## 내가 처음 생각한 풀이 (오답)

### 사고 흐름

1. **문자열로 변환한 뒤 앞자리 기준으로 정렬한다** — `9 > 8 > 7 > ... > 1 > 0`
2. **앞자리가 같은 문자열끼리 묶어서, 뒷자리부터 비교하며 다시 정렬한다**

예를 들어, `[3, 30, 34]`가 있으면:
- 앞자리가 모두 `3`이니까 같은 그룹
- 뒷자리를 비교: `34 > 3 > 30` (?)

이 로직이면 `34330`이 나올 것 같은데…

### 왜 틀렸는가?

이 방식은 **한 자리 수와 여러 자리 수의 비교에서 문제가 생긴다.**

| 비교 대상 | 내 방식의 결과 | 실제 정답 |
|-----------|--------------|----------|
| `3` vs `30` | `3`의 뒷자리가 없으므로 비교 기준이 모호 | `3` + `30` = `330` > `303` = `30` + `3` → `3`이 먼저 |
| `3` vs `34` | `34`가 뒷자리 `4`가 있으니 `34`가 먼저? | `34` + `3` = `343` > `334` = `3` + `34` → `34`가 먼저 |
| `3` vs `32` | `32`가 먼저? | `3` + `32` = `332` > `323` = `32` + `3` → `3`이 먼저 |

`3` vs `32`를 보면, 뒷자리 비교 방식으로는 `32`가 먼저 와야 할 것 같지만, 실제로는 `332 > 323`이므로 `3`이 먼저 와야 한다.

**뒷자리 비교 방식은 일관된 정렬 기준을 만들어내지 못한다.** 특히 한 자리 수가 여러 자리 수 사이에 끼어야 하는 위치를 정확히 결정할 수 없다.

---

## 올바른 풀이: 두 수를 이어 붙여서 비교

핵심 아이디어는 단순하다:

> **두 수 `a`, `b`를 이어 붙인 `ab`와 `ba`를 비교해서, 더 큰 쪽이 오도록 정렬한다.**

예를 들어, `a = 3`, `b = 30`이면:
- `a + b` = `"330"`
- `b + a` = `"303"`
- `330 > 303`이므로 `3`이 `30`보다 앞에 온다

이 방식이면 **어떤 조합이든 정확하게 비교할 수 있다.**

### Java 풀이 코드

```java
import java.util.Arrays;

class Solution {
    public String solution(int[] numbers) {
        // int 배열을 String 배열로 변환
        String[] strNumbers = new String[numbers.length];
        for (int i = 0; i < numbers.length; i++) {
            strNumbers[i] = String.valueOf(numbers[i]);
        }

        // 핵심: 두 수를 이어 붙여서 비교
        Arrays.sort(strNumbers, (a, b) -> (b + a).compareTo(a + b));

        // 모든 수가 0인 경우 처리
        if (strNumbers[0].equals("0")) {
            return "0";
        }

        // 정렬된 문자열을 이어 붙이기
        StringBuilder sb = new StringBuilder();
        for (String s : strNumbers) {
            sb.append(s);
        }

        return sb.toString();
    }
}
```

### 핵심 한 줄

```java
Arrays.sort(strNumbers, (a, b) -> (b + a).compareTo(a + b));
```

- `b + a`와 `a + b`를 문자열 비교하여 **내림차순** 정렬
- 예: `a = "3"`, `b = "30"` → `"303".compareTo("330")` → 음수 → `"3"`이 앞으로

### 배운 점

처음 생각한 "뒷자리부터 비교" 방식은 **모든 경우를 커버하는 일관된 비교 함수를 만들 수 없다.** 반면 "이어 붙여서 비교"는 **비교 함수 자체가 정답의 정의와 일치**하기 때문에 정확하다.

> 💡 **정렬 문제에서 비교 기준이 복잡해질 때는, 최종 결과물의 형태로 직접 비교하는 것이 가장 확실하다.**

---

## Java Comparator / Comparable 정리

이 문제를 풀면서 `Comparator`가 약하다는 걸 느꼈다. 기본부터 정리해본다.

### Comparable — 객체 자신의 기본 정렬 기준

`Comparable<T>`를 구현하면 해당 클래스의 **자연 순서(natural ordering)**를 정의한다.

```java
public class Student implements Comparable<Student> {
    private String name;
    private int score;

    public Student(String name, int score) {
        this.name = name;
        this.score = score;
    }

    // 기본 정렬: 점수 오름차순
    @Override
    public int compareTo(Student other) {
        return Integer.compare(this.score, other.score);
    }

    @Override
    public String toString() {
        return name + "(" + score + ")";
    }
}
```

```java
List<Student> students = new ArrayList<>(List.of(
    new Student("Alice", 85),
    new Student("Bob", 92),
    new Student("Carol", 78)
));

Collections.sort(students); // compareTo 기준으로 정렬
// 결과: [Carol(78), Alice(85), Bob(92)]
```

### compareTo 반환값 규칙

| 반환값 | 의미 |
|--------|------|
| **음수** | `this`가 `other`보다 **앞** (작다) |
| **0** | 같다 |
| **양수** | `this`가 `other`보다 **뒤** (크다) |

> 💡 기억법: `this - other` → 오름차순, `other - this` → 내림차순

---

### Comparator — 외부에서 정렬 기준 주입

`Comparable`이 클래스 내부에 **하나의** 정렬 기준을 정의한다면,  
`Comparator`는 **외부에서** 원하는 정렬 기준을 **유연하게** 주입한다.

#### 1. 익명 클래스 방식

```java
Collections.sort(students, new Comparator<Student>() {
    @Override
    public int compare(Student a, Student b) {
        return a.getName().compareTo(b.getName()); // 이름 오름차순
    }
});
```

#### 2. 람다 표현식 (Java 8+)

```java
// 점수 내림차순
students.sort((a, b) -> b.getScore() - a.getScore());

// 이름 오름차순
students.sort((a, b) -> a.getName().compareTo(b.getName()));
```

#### 3. Comparator 정적 메서드 활용 (Java 8+)

```java
// 점수 오름차순
students.sort(Comparator.comparingInt(Student::getScore));

// 점수 내림차순
students.sort(Comparator.comparingInt(Student::getScore).reversed());

// 점수 오름차순 → 같으면 이름 오름차순
students.sort(
    Comparator.comparingInt(Student::getScore)
              .thenComparing(Student::getName)
);
```

---

### 주요 Comparator 메서드 정리

| 메서드 | 설명 | 예시 |
|--------|------|------|
| `Comparator.comparingInt()` | int 기준 정렬 | `Comparator.comparingInt(Student::getScore)` |
| `Comparator.comparing()` | Comparable 필드 기준 정렬 | `Comparator.comparing(Student::getName)` |
| `.reversed()` | 역순 | `Comparator.comparingInt(Student::getScore).reversed()` |
| `.thenComparing()` | 2차 정렬 기준 추가 | `.thenComparing(Student::getName)` |
| `.thenComparingInt()` | 2차 정렬 (int 기준) | `.thenComparingInt(Student::getAge)` |
| `Comparator.naturalOrder()` | 자연 순서 (오름차순) | `Comparator.naturalOrder()` |
| `Comparator.reverseOrder()` | 자연 순서의 역순 | `Comparator.reverseOrder()` |
| `Comparator.nullsFirst()` | null을 앞으로 | `Comparator.nullsFirst(Comparator.naturalOrder())` |
| `Comparator.nullsLast()` | null을 뒤로 | `Comparator.nullsLast(Comparator.naturalOrder())` |

---

### 어디에서 사용하는가?

```java
// Arrays.sort (배열)
String[] arr = {"banana", "apple", "cherry"};
Arrays.sort(arr, Comparator.reverseOrder());

// Collections.sort (리스트)
List<String> list = new ArrayList<>(List.of("banana", "apple", "cherry"));
Collections.sort(list, Comparator.naturalOrder());

// List.sort (리스트 - 직접 호출)
list.sort(Comparator.reverseOrder());

// Stream.sorted (스트림)
list.stream()
    .sorted(Comparator.reverseOrder())
    .collect(Collectors.toList());

// TreeSet / TreeMap (정렬된 컬렉션)
Set<String> set = new TreeSet<>(Comparator.reverseOrder());
Map<String, Integer> map = new TreeMap<>(Comparator.reverseOrder());

// PriorityQueue (우선순위 큐)
PriorityQueue<Integer> maxHeap = new PriorityQueue<>(Comparator.reverseOrder());
```

---

### Comparable vs Comparator 요약

| 항목 | Comparable | Comparator |
|------|-----------|------------|
| 패키지 | `java.lang` | `java.util` |
| 메서드 | `compareTo(T o)` | `compare(T o1, T o2)` |
| 구현 위치 | 클래스 내부 | 클래스 외부 |
| 정렬 기준 수 | 1개 (자연 순서) | 여러 개 가능 |
| 용도 | 기본 정렬이 명확할 때 | 다양한 정렬 기준이 필요할 때 |
| 사용 예 | `Collections.sort(list)` | `Collections.sort(list, comparator)` |

---

## 마무리

정렬 문제를 풀 때 기억할 것:

1. **비교 기준이 복잡하면**, 최종 결과물의 형태로 직접 비교하자 (이어 붙여서 비교)
2. **Java에서 정렬 커스터마이징**은 `Comparator` 람다 한 줄이면 충분하다
3. **다중 정렬**이 필요하면 `thenComparing()`을 체이닝하자
