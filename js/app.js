(function ($, BirdCount) {

    // window.initMap = async function() {
    //     const map = new google.maps.Map(document.getElementById("map"), {
    //         zoom: 10,
    //         center: { lat: 0, lng: 0 },
    //     });

    //     const geoLocationMarker = new (await GeoLocationMarker).GeoLocationMarker();
    //     geoLocationMarker.setMap(map);
    // };

    var app = $.sammy('#main', function () {
        var maps = {};

        function getOrCreateMap(id) {
            var map = maps[id];
            if (!map) {
                console.log("Creating map for:", id);
                map = BirdCount.createMap(MAP_DATA[id]);
                maps[id] = map;
            }
            return map;
        }

        this.get('#/', function (context) {
            var first = $('ul.nav a:first').attr('href');
            console.log("Redirecting to:", first); 
            this.redirect(first);
        });

        this.get('#/ahmedabad/:district', function (context) {
            var district = this.params['district'],
                map = getOrCreateMap(district);
            console.log("Showing map for district:", district); 
            $('ul.nav a[data-target="#' + district + '"]').tab('show');
            map.recenter();
        });
    });

    $(window).load(function () {
        app.run('#/');

        var navbar = $("#navbar");
        $('ul.nav a').click(function (e) {
            app.setLocation($(this).attr('href'));
            navbar.collapse('hide');
        });
    });
})(jQuery, BirdCount);
