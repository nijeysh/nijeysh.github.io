(function () {
    var container = document.getElementById('post-cards');
    var pagination = document.getElementById('pagination');
    if (!container || !pagination) return;

    var cards = Array.from(container.querySelectorAll('[data-post]'));
    var perPage = 1;
    var total = Math.ceil(cards.length / perPage);
    var current = 1;
    var WIN = 5;

    function render() {
        cards.forEach(function (card, i) {
            var page = Math.floor(i / perPage) + 1;
            card.style.display = (page === current) ? '' : 'none';
        });

        var gs = Math.floor((current - 1) / WIN) * WIN + 1;
        var ge = Math.min(gs + WIN - 1, total);

        var html = '';

        if (gs > 1) {
            html += '<a class="page-num" href="#" data-page="' + (gs - 1) + '">&laquo;</a>';
        }

        for (var p = gs; p <= ge; p++) {
            if (p === current) {
                html += '<span class="page-num active">' + p + '</span>';
            } else {
                html += '<a class="page-num" href="#" data-page="' + p + '">' + p + '</a>';
            }
        }

        if (ge < total) {
            html += '<a class="page-num" href="#" data-page="' + (ge + 1) + '">&raquo;</a>';
        }

        pagination.innerHTML = html;

        pagination.querySelectorAll('a[data-page]').forEach(function (a) {
            a.addEventListener('click', function (e) {
                e.preventDefault();
                current = parseInt(this.getAttribute('data-page'));
                render();
                window.scrollTo({ top: 0, behavior: 'smooth' });
            });
        });
    }

    if (total > 1) {
        render();
    }
})();
