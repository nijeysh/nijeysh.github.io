---
layout: default
title: Spring
category: tech
---

{% assign tag_posts = site.posts | where_exp: "post", "post.tags contains 'spring'" %}
{% if tag_posts.size > 0 %}
<div class="post-cards" id="post-cards">
  {% for post in tag_posts %}
  <a href="{{ post.url | absolute_url }}" class="post-card" data-post>
    <div class="post-card-thumb">
      <span class="post-card-tag">spring</span>
    </div>
    <div class="post-card-body">
      <h3 class="post-card-title">{{ post.title }}</h3>
      <p class="post-card-excerpt">{{ post.excerpt | strip_html | truncate: 80 }}</p>
      <span class="post-card-date">{{ post.date | date: "%b %d, %Y" }}</span>
    </div>
  </a>
  {% endfor %}
</div>
<div class="pagination-numbers" id="pagination"></div>
<script src="{{ site.baseurl }}/public/js/paginate.js"></script>
{% else %}
<div class="empty-posts">
  <p>조회된 게시글이 없습니다.</p>
</div>
{% endif %}
