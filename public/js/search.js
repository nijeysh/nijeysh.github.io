(function () {
    var searchInput = document.getElementById('search-input');
    var searchResults = document.getElementById('search-results');
    if (!searchInput || !searchResults) return;

    var posts = [];

    // atom.xml / feed.xml 파싱으로 포스트 목록 생성
    function loadPosts() {
        var feedUrl = '/feed.xml';
        fetch(feedUrl)
            .then(function (res) { return res.text(); })
            .then(function (text) {
                var parser = new DOMParser();
                var xml = parser.parseFromString(text, 'application/xml');
                var items = xml.querySelectorAll('entry, item');
                posts = Array.from(items).map(function (item) {
                    var titleEl = item.querySelector('title');
                    var linkEl = item.querySelector('link');
                    var dateEl = item.querySelector('published, pubDate');
                    var contentEl = item.querySelector('content, description, summary');
                    return {
                        title: titleEl ? titleEl.textContent.trim() : '',
                        url: linkEl ? (linkEl.getAttribute('href') || linkEl.textContent.trim()) : '',
                        date: dateEl ? dateEl.textContent.trim().slice(0, 10) : '',
                        excerpt: contentEl ? contentEl.textContent.replace(/<[^>]+>/g, '').slice(0, 100) : ''
                    };
                });
            })
            .catch(function (e) { console.warn('search: feed 로드 실패', e); });
    }

    loadPosts();

    searchInput.addEventListener('input', function () {
        var query = this.value.trim().toLowerCase();
        searchResults.innerHTML = '';
        if (query.length < 2) return;

        var matched = posts.filter(function (p) {
            return (p.title && p.title.toLowerCase().includes(query)) ||
                (p.excerpt && p.excerpt.toLowerCase().includes(query));
        }).slice(0, 8);

        if (matched.length === 0) {
            var li = document.createElement('li');
            li.style.cssText = 'padding:.5rem .75rem;font-size:.8rem;color:#9a9a9a';
            li.textContent = '결과 없음';
            searchResults.appendChild(li);
            return;
        }

        matched.forEach(function (p) {
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
