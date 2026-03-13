(function (document) {
  var toggle = document.querySelector('.sidebar-toggle');
  var sidebar = document.querySelector('#sidebar');
  var checkbox = document.querySelector('#sidebar-checkbox');

  // Listen for manual toggles to save state
  checkbox.addEventListener('change', function () {
    localStorage.setItem('sidebar-open', checkbox.checked);
  });

  // Also close sidebar on outside clicks (only on small screens usually)
  document.addEventListener('click', function (e) {
    var target = e.target;
    if (!checkbox.checked ||
      sidebar.contains(target) ||
      (target === checkbox || target === toggle)) return;

    checkbox.checked = false;
    localStorage.setItem('sidebar-open', 'false');
  }, false);
})(document);
