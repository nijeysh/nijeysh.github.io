(function () {
    var searchInput = document.getElementById('search-input');
    var searchResults = document.getElementById('search-results');
    if (!searchInput || !searchResults) return;

    var postsStore = {};
    var idx = null;

    // JSON 인덱스 파일 로드 및 Lunr 초기화
    function loadSearchData() {
        var searchUrl = '/search.json';
        fetch(searchUrl)
            .then(function (res) { return res.json(); })
            .then(function (data) {
                // 데이터를 기반으로 Lunr 인덱스 생성
                idx = lunr(function () {
                    // 한국어 플러그인 사용
                    this.use(lunr.ko);

                    this.ref('id');
                    this.field('title', { boost: 10 });
                    this.field('category');
                    this.field('content');
                    this.field('excerpt');

                    data.forEach(function (doc, index) {
                        this.add({
                            'id': index,
                            'title': doc.title,
                            'category': doc.category,
                            'content': doc.content,
                            'excerpt': doc.excerpt
                        });

                        // 원본 데이터 저장 (검색 결과 표출용)
                        postsStore[index] = {
                            'title': doc.title,
                            'url': doc.url,
                            'date': doc.date,
                            'excerpt': doc.excerpt.substring(0, 100) + '...'
                        };
                    }, this);
                });
            })
            .catch(function (e) {
                console.warn('search: search.json 로드 실패', e);
            });
    }

    loadSearchData();

    searchInput.addEventListener('input', function () {
        var query = this.value.trim().toLowerCase();
        searchResults.innerHTML = '';

        if (query.length < 2 || !idx) return;

        // Lunr를 사용한 검색 수행 (fuzziness 허용)
        var results = idx.search(query + '*').slice(0, 8); // 최대 8개 결과 표시

        if (results.length === 0) {
            var li = document.createElement('li');
            li.style.cssText = 'padding:.5rem .75rem;font-size:.8rem;color:#9a9a9a';
            li.textContent = '결과 없음';
            searchResults.appendChild(li);
            return;
        }

        results.forEach(function (result) {
            var p = postsStore[result.ref];
            var li = document.createElement('li');
            var a = document.createElement('a');
            a.href = p.url;
            a.innerHTML = p.title + '<span class="result-date"> ' + p.date + '</span>';
            li.appendChild(a);
            searchResults.appendChild(li);
        });
    });

    // 검색 영역 외부 클릭 시 결과 닫기
    document.addEventListener('click', function (e) {
        if (!e.target.closest('.masthead-search')) {
            searchResults.innerHTML = '';
        }
    });
})();
