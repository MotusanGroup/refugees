jQuery(document).ready(function(){

	jQuery('#content').gmap3({
		 map:{
		    options:{
		     center:[22.49156846196823, 89.75802349999992],
		     zoom:2,
		     mapTypeId: google.maps.MapTypeId.SATELLITE,
		     mapTypeControl: true,
		     mapTypeControlOptions: {
		       style: google.maps.MapTypeControlStyle.DROPDOWN_MENU
		     },
		     navigationControl: true,
		     scrollwheel: true,
		     streetViewControl: true
		    }
		 }		
	});
	
	jQuery('span.year').on('mousedown', function(ev){
		RFG.isDragging = true;
		RFG.startDragPosition = {x : ev.clientX, y : ev.clientY};
	});
	
	jQuery('span.year').on('mouseup', function(ev){
		if(RFG.isDragging){
			RFG.isDragging = false;
			
			var startPos = RFG.startDragPosition;
			var endPos = {x : ev.clientX, y : ev.clientY};			
			var diffX = endPos.x - startPos.x;
			
			if(diffX > 0){
				RFG.yearUp();
			}
			else {
				RFG.yearDown();
			}
			jQuery(this).text(RFG.currentYear);			
		}
	});
	
	jQuery('.btn-down').on('click', function(){
		RFG.yearDown();
		jQuery('span.year').text(RFG.currentYear);
	});
	
	jQuery('.btn-up').on('click', function(){
		RFG.yearUp();
		jQuery('span.year').text(RFG.currentYear);
	});
	
	RFG.loadData();
});


var RFG = {
		records : null,
		countryData : null,
		migrationLines : [],
		selectedLine : null,
		minYear : 2002,
		maxYear : 2013,
		currentYear : 2013,
		currentCountry : null,
		
		// ---------------------------------------------------------------------------------------
		loadData : function(){
			console.log('loading data');
			//var dataUrl = 'data/UNdata_Export_20141127_002205221.xml';
			var dataUrl = 'data/UNdata_Export_20141127_002205221.json';
			
			this.startWaiting();
			jQuery.getJSON( "data/countries.json", function(data) {
				RFG.countryLatLngs = data;
				
				jQuery.ajax({
					url: dataUrl,
				}).done(function(data){
					RFG.onLoadData(data);
				})
				.fail(function(jqXHR, textStatus, errorThrown){
					console.error(errorThrown);
				});
			});									
		},
		
		// ---------------------------------------------------------------------------------------
		onLoadData : function(data){
			console.log('data loaded');
			var me = RFG;
			delete me.records;			
			me.records = data;
			//me.records = me.parseXML(data);
			
			me.stopWaiting();									
			
			var recordCount = me.records.length;
			//var sum = [1, 2, 3].reduce( function(total, num){ return total + num }, 0);
			var countryData = {};
			
			console.log('Creating country data array');
			for(var i=0; i<recordCount; i++){
				var cntryRec = me.records[i];
				if(typeof countryData[cntryRec.origin] == 'undefined'){
					countryData[cntryRec.origin] = {};
				}
				
				countryData[cntryRec.origin].country = cntryRec.origin;
				
				if(typeof countryData[cntryRec.origin].years == 'undefined'){
					countryData[cntryRec.origin].years = {};
				}
				
				if(typeof countryData[cntryRec.origin].years[cntryRec.year] == 'undefined'){
					countryData[cntryRec.origin].years[cntryRec.year] = {};
				}
				
				countryData[cntryRec.origin].years[cntryRec.year][cntryRec.destination] = cntryRec;						
			}
			
			me.countryData = countryData;			
			me.createMarkers();
			
			console.log('Done');
		},
		
		// ---------------------------------------------------------------------------------------
		createMarkers : function(){
			console.log('Creating markers and info window');
			var me = RFG;
			
			var markerValues = [];
			for(var ndx in me.countryData){
				var country = me.countryData[ndx];
				markerValues.push({
					// address : country.country,
					latLng: me.getLatLng(country),
					data: {country: country, year : RFG.currentYear},
				});
			}
			
			jQuery('#content').gmap3({
				marker : {
					values : markerValues,
					events:{
						click : function(marker, event, context){
							var infoWin = RFG.getInfoWindow(this);
							if(infoWin && infoWin.position != null){								
								RFG.hideInfo(this);
								RFG.keepInfoOpen = false;
							}
							else{
								RFG.currentCountry = context.data.country;
								RFG.showInfo(this, marker, context);
								RFG.keepInfoOpen = true;
							}
						},
						mouseover : function(marker, event, context){
							if(!RFG.keepInfoOpen){
								RFG.currentCountry = context.data.country;
								RFG.showInfo(this, marker, context);
							}
						},
						mouseout : function(){
							if(!RFG.keepInfoOpen){
								RFG.hideInfo(this);
							}
						}
				    }				
				}
			});			
		},
		
		// ---------------------------------------------------------------------------------------
		parseXML : function(data){
			console.log('Parsing record XML');
			var jqRecs = jQuery(data).find('record');
			var current = 0, count = jqRecs.size();
			console.log('total records: ' + count);
						
			var lastPerc = 0, newPerc = 0;
			jqRecs.each(function(){
				var jqRec = jQuery(this);
				var rec = {
						origin : jqRec.find("field[name='Country or territory of origin']").text(),
						destination : jqRec.find("field[name='Country or territory of asylum or residence']").text(),
						year : jqRec.find("field[name='Year']").text(),
						refugees : jqRec.find("field[name='Refugees<sup>*</sup>']").text(),
						refugeesAssistedByUNHCR : jqRec.find("field[name='Refugees assisted by UNHCR']").text(),
						refugeesAndInSit : jqRec.find("field[name='Total refugees and people in refugee-like situations<sup>**</sup>']").text(),
						refugeesAndInSitAssistedByUNHCR : jqRec.find("field[name='Total refugees and people in refugee-like situations assisted by UNHCR']").text()
				};
				me.records.push(rec);
				newPerc = Math.floor((++current / count) * 100);
				if(newPerc > lastPerc){
					console.log(newPerc + '% done');
				}
				lastPerc = newPerc;
			});			
		},
		
		// ---------------------------------------------------------------------------------------
		getLatLng : function(country){
			// returns an array: [29.132318972825445,81.32052349999992]
			for(ndx in RFG.countryLatLngs){
				if(country.country == ndx){
					var latLng = RFG.countryLatLngs[ndx];
					var coords = [latLng.lat, latLng.long];
					return coords;
				}
			}			
		},
		
		// ---------------------------------------------------------------------------------------
		getPinContent : function(country, year){			
			var str = '<div class="rfgwin"><h4>' + country.country + ' (' + year + ')</h4><div class="listholder"><ul>';
			
			RFG.removeMigrationLines();
			
			var yearData = country.years[year];
			if(typeof yearData != 'undefined'){			
				for(ndx in yearData){					
					if(typeof ndx == 'string'){
						var info = yearData[ndx];
						var id = info.origin + '-' + info.destination;
						if(typeof info != 'undefined'){	
							str += '<li><a id="' + id + '">' + info.destination + '</a>: ' + info.refugees + '</li>';
							RFG.drawMigrationLine(info);
						}
					}
				}
			}
			return str + '</ul></div></div>';
		},
		
		// ---------------------------------------------------------------------------------------
		drawMigrationLine : function(info){
			/* 
			 * line thickness:
			 * <= 10 = 1
			 * <= 100 = 2
			 * <= 1000 = 4
			 * > 1000 = 8;
			 */
			var strokeWeight = info.refugees <= 10 ? 1 : 
					info.refugees <= 100 ? 2 :
					info.refugees <= 1000 ? 4 : 8;			
			
			try{
				var map = jQuery('#content').gmap3('get');
				var orgLatLng = RFG.countryLatLngs[info.origin];
				var destLatLng = RFG.countryLatLngs[info.destination];
				
				if(typeof destLatLng == 'undefined'){
					console.error('Invalid destLatLng for ' + info.destination);
				}
				
				var pathPoints = [
					new google.maps.LatLng(orgLatLng.lat, orgLatLng.long),
					new google.maps.LatLng(destLatLng.lat, destLatLng.long)
				];
	             var path = new google.maps.Polyline({
	               path: pathPoints,
	               geodesic: true,
	               strokeColor: '#FF0000',
	               strokeOpacity: 1.0,
	               strokeWeight: strokeWeight
	             });
	             path.setMap(map);
	             var id = info.origin + '-' + info.destination;
	             path.set('id', id);
	             
	             RFG.migrationLines[id] = path;
			}
			catch(e){
				console.error(e);
			}
		},

		// ---------------------------------------------------------------------------------------
		getMigrationLine : function(originName, destinationName){
			var line = RFG.migrationLines[originName + '-' + destinationName];
			if(typeof line == 'undefined'){
				return false;
			}
			return line;
		},
		
		// ---------------------------------------------------------------------------------------
		removeMigrationLines : function(){
			for(var ndx in RFG.migrationLines){
				RFG.migrationLines[ndx].setMap(null);
				delete RFG.migrationLines[ndx];
			}
		},
		
		// ---------------------------------------------------------------------------------------
		startWaiting : function(){
			jQuery('body').addClass('waiting');
		},

		// ---------------------------------------------------------------------------------------
		stopWaiting : function(){
			jQuery('body').removeClass('waiting');
		},

		// ---------------------------------------------------------------------------------------
		yearDown : function(){
			if(RFG.currentYear > RFG.minYear){
				RFG.currentYear--;
				RFG.createMarkers();
				RFG.updateInfo();
			}
		},
		
		// ---------------------------------------------------------------------------------------
		yearUp : function(){
			if(RFG.currentYear < RFG.maxYear){
				RFG.currentYear++;
				RFG.createMarkers();
				RFG.updateInfo();
			}
		},
		
		// ---------------------------------------------------------------------------------------
		updateInfo : function(){
			if(RFG.currentCountry == null){
				return;
			}
			var infowindow = RFG.getInfoWindow();
			if(infowindow){
				var content = RFG.getPinContent(RFG.currentCountry, RFG.currentYear);
				infowindow.setContent(content);
			}
		},
		
		// ---------------------------------------------------------------------------------------
		showInfo : function(el, marker, context){
			var country = context.data.country;
			var year = context.data.year;
			
			if(RFG.currentYear && RFG.currentYear != year){
				year = RFG.currentYear;
			}
			
			var content = RFG.getPinContent(country, year);
			
			var map = jQuery(el).gmap3('get');
			var infowindow = RFG.getInfoWindow(el);			
			if (infowindow){
				infowindow.open(map, marker);
				infowindow.setContent(content);				
			}
			else {
				jQuery(el).gmap3({
					infowindow:{
						anchor:marker, 
						options:{content: content}
					}
				});
				infowindow = RFG.getInfoWindow(el);
			}
			
			infowindow.set('id', country.country);
			
			jQuery('.rfgwin a').on('click', function(){
				var id = jQuery(this).attr('id');
				
				if(RFG.selectedLine){
					RFG.selectedLine.setOptions({strokeColor : 'red', zIndex : -1});
				}
				
				var line = RFG.migrationLines[id];
				if(line){
					line.setOptions({strokeColor : 'yellow', zIndex : 1000});
					RFG.selectedLine = line;
				}
			});
		},
		
		// ---------------------------------------------------------------------------------------
		hideInfo : function(el){
			var infowindow = RFG.getInfoWindow(el);
			if (infowindow){
				infowindow.close();				
			}
			RFG.currentCountry = null;
		},
		
		// ---------------------------------------------------------------------------------------
		getInfoWindow : function(el){
			if(el==null){
				el = jQuery('#content').get(0);
			}
			return jQuery(el).gmap3({ get: {name : 'infowindow'} });
		}
		
};