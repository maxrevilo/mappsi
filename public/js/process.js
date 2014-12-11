$(document).ready(function(){
    console.log("ready");
    function submit(event) {
        $(".loading").show();
        $.post("/", { keyword: $("#name").val()})
            .done(function(data) {
                console.log(data);
                watsonData = JSON.parse(data);
                showMap();
            })
            .always(function() {
                $(".loading").hide();
            });

        event.preventDefault();
        return false;
    }
    $( "#target" ).click(submit);
    $( "#name" ).keypress(function (e) {
        if (e.which == 13) {
            return submit(e);
        }
    });
});

var watsonData = [
    {
        "name" : "colombia",
        "count" : 10
    },
];

function getCoordinates(place, count){
    var coordinates;
    $.get( "http://maps.googleapis.com/maps/api/geocode/json?address="+place+"&sensor=true_or_false", function( data ) {
        printCordinates(data, count, place);
    });
}

function printCordinates(data, count, place){
    // console.log(data);
    var _coordinate = data.results[0].geometry.location;
    var _type = data.results[0].geometry.location_type;
    var _bounds = data.results[0].geometry.bounds
    var object = {  
                    coordinates  : _coordinate,
                    type    : _type,
                    bounds  : _bounds,
    };
    console.log(object);
    
    var cityCircle = new google.maps.Circle({
            strokeColor: '#FF0000',
            strokeOpacity: 0.8,
            strokeWeight: 2,
            fillColor: '#FF0000',
            fillOpacity: 0.35,
            map: map,
            center: new google.maps.LatLng(object.coordinates.lat, object.coordinates.lng),
            radius: count * 100000,
            name: place
        });

            var contentString = "<div>"+cityCircle.name+"</div>";
            var infowindow = new google.maps.InfoWindow({
                content: contentString
            });
            infowindow.setPosition(cityCircle.center);

     google.maps.event.addListener(cityCircle, 'click', function() {
            infowindow.open(map);
    });
}

var citymap = {};

var map;

function initialize() {
    // Create the map.
    var mapOptions = {
        zoom: 2,
        center: new google.maps.LatLng(37.09024, -95.712891),
        mapTypeId: google.maps.MapTypeId.TERRAIN
    };

    map =  new google.maps.Map(document.getElementById('map-canvas'),
            mapOptions);

    watsonData.forEach(function(entry) {
        getCoordinates(entry.name, entry.count);
    });
}

// google.maps.event.addDomListener(window, 'load', initialize);

function showMap(){
    $("#step").fadeOut('fast', function() {
        
    });
    $("#map-canvas").fadeIn('fast', function() {
        
    });
    initialize();
}
