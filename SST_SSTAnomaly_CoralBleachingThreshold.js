//*********************************************************************//
/////////////////////////////////////////////////////////////////////////
// Sea Surface Temperature, SST Anomaly, and Coral Bleaching Threshold //
/////////////////////////////////////////////////////////////////////////
//*********************************************************************//

// This code explores sea surface temperature, sea surface temperature anomaly, and the coral bleaching threshold
// for a given area. The code is currently set for Southern Florida in July 2023, but users can change the geometry, 
// start/end date, and point of interest to view other areas.
// The data sources are as follows:
// - Sea Surface Temperature: GCOM-C/SGLI L3 Sea Surface Temperature (V2) and GCOM-C/SGLI L3 Sea Surface Temperature (V3)
// Methodology sources are as follows:
// - Anomaly calculation: https://developers.google.com/earth-engine/tutorials/community/anomalies-analysis-smo-and-pre
// - Coral Bleaching Threshold and Heat Stress: https://coralreefwatch.noaa.gov/satellite/education/tutorial/crw22_bleachingthreshold.php 

// Created by Britnay Beaudry. View at: https://github.com/britnaybeaudry/SST_SSTAnomaly_CoralBleachingThreshold 

//Start of Code

// Define a study area
var geometry = ee.Geometry.Rectangle(-83.0468, 25.3439, -80.1135, 24.352); // South of Florida

// Set map center 
Map.centerObject(geometry, 9);
// Set basemap to satellite
Map.setOptions('SATELLITE');

///////////////////////////
// GCOM-C SGLI V2 and V3 //
///////////////////////////

// Create function to apply scaling factors to GCOM-C SGLI Ocean Data
function applyScaleFactor(image) {
  var sstOffset = image.select('SST_AVE').multiply(0.0012).add(-10);
  return image.addBands(sstOffset, null, true);
}

// Filter GCOM-C V2 data from start date to end date
var gcomcv2 = ee.ImageCollection('JAXA/GCOM-C/L3/OCEAN/SST/V2')
                .filterDate('2018-01-01', '2021-11-28') // Dataset availability: 2018-01-01T00:00:00 - 2021-11-28T00:00:00
                .select('SST_AVE')
                .map(applyScaleFactor);

// Filter GCOM-C V3 data from start date to present
var gcomcv3 = ee.ImageCollection('JAXA/GCOM-C/L3/OCEAN/SST/V3')
                .filterDate('2021-11-29', '2023-07-31') // Current dataset availability: 2021-11-29T00:00:00Z - 2023-07-31T00:00:00
                .select('SST_AVE')
                .map(applyScaleFactor);

var gcomc_merged = gcomcv2.merge(gcomcv3); //merge gcom-c image collections

///////////////
// SST Chart //
///////////////
var point = ee.Geometry.Point([-81.2132, 24.7198]); // Select a lat, lon in an area of interest

// Create a chart for the SST
var chart = ui.Chart.image.doySeriesByYear({
  imageCollection: gcomc_merged,
  bandName: 'SST_AVE',
  region: point,
  regionReducer: ee.Reducer.mean(),
  sameDayReducer: ee.Reducer.mean(),
                  startDay: 1,
                  endDay: 365,});

// Set chart style properties
var chartStyle = {
  title: 'Sea Surface Temperature by Day of Year (GCOM-C)',
  hAxis: {
    title: 'Day of Year',
    titleTextStyle: {italic: false, bold: true}
  },
  vAxis: {
    title: 'SST (°C)',
    titleTextStyle: {italic: false, bold: true},
    viewWindow: {min: 15, max: 35},
  },
 trendlines: {
    0: {  // add a trend line for each year
      type: 'polynomial',
      color: 'd9ed92',
      lineWidth: 3,
      opacity: 0.2,
      visibleInLegend: true,
    },
    1: {
      type: 'polynomial',
      color: '99d98c',
      lineWidth: 3,
      opacity: 0.2,
      visibleInLegend: true,
    },
    2: {
      type: 'polynomial',
      color: '52b69a',
      lineWidth: 3,
      opacity: 0.2,
      visibleInLegend: true,
    },
    3: {
      type: 'polynomial',
      color: '168aad',
      lineWidth: 3,
      opacity: 0.2,
      visibleInLegend: true,
    },
    4: { 
      type: 'polynomial',
      color: '1e6091',
      lineWidth: 3,
      opacity: 0.2,
      visibleInLegend: true,
    },
    5: {
      type: 'polynomial',
      color: '184e77',
      lineWidth: 3,
      opacity: 0.2,
      visibleInLegend: true,
    }
  },
  lineWidth: 3,
  pointSize: 4,
  interpolateNulls: true,
  colors: ['d9ed92', '99d98c', '52b69a', '168aad', '1e6091', '184e77'] // trend line color matches SST color
};

// Apply style properties to the chart
chart.setOptions(chartStyle);

//Print chart to Console tab
print(chart);

/////////////////
// SST Anomaly //
/////////////////
// Code from this section was adapted from NASA GSFC's "Anomalies Analysis of Soil Moisture and Precipitation Over a River Basin" tutorial
// Link to tutorial: https://developers.google.com/earth-engine/tutorials/community/anomalies-analysis-smo-and-pre 

// Define study period
var startYear = 2018;
var endYear = 2023;
var startMonth = 1;
var endMonth = 12;

var startDate = ee.Date.fromYMD(startYear, startMonth, 1);
var endDate = ee.Date.fromYMD(endYear, endMonth, 31);
var years = ee.List.sequence(startYear, endYear);
var months = ee.List.sequence(1, 12);

// Define a function to compute the anomaly for a given month
var computeAnomalySST = function(image) {
  // Get the month of the image
  var year = image.date().get('year');
  var month = image.date().get('month');
  // Get the corresponding reference image for the month
  var referenceImage = meanMonthlySST.filter(
      ee.Filter.eq('month', month)).first();
  // Check if the images have bands
  var hasBands = image.bandNames().size().gt(0);
  // Compute the anomaly by subtracting reference image from input image
  var anomalyImage = ee.Algorithms.If(
    hasBands,
    image.subtract(referenceImage),
    image);

  return ee.Image(anomalyImage).set(
    'system:time_start', ee.Date.fromYMD(year, month, 1).millis());
};

// SST
var SST =  gcomc_merged
  .filterDate(startDate, endDate)
  .sort('system:time_start', true)  // sort a collection in ascending order
  .select(['SST_AVE']);  // SST band

// Compute monthly SST
var monthlySST =  ee.ImageCollection.fromImages(
  years.map(function(y) {
    return months.map(function(m) {
      var filtered =  SST
                          .filter(ee.Filter.calendarRange(y, y, 'year'))
                          .filter(ee.Filter.calendarRange(m, m, 'month'))
                          .mean();
      return filtered.set({
        'month': m,
        'system:time_start': ee.Date.fromYMD(y, m, 1).millis()
      });
    });
  }).flatten()
);

// Compute climatological monthly SST
var meanMonthlySST = ee.ImageCollection.fromImages(
  ee.List.sequence(1, 12).map(function(m) {
    var filtered = monthlySST.filter(ee.Filter.eq('month', m)).mean();
    return filtered.set('month', m);
  })
);

// Map the function over the monthly SST collection to compute
// the anomaly SST for each month
var monthlySSTAnomalies = monthlySST.map(
    computeAnomalySST);

// Combine two image collections into one collection
var SST_SSTA_Datasets = monthlySST.combine(monthlySSTAnomalies);
// print('SST and SST Anomalies', SST_SSTA_Datasets);

////////////////////////////
// Monthly Mean SST Chart //
////////////////////////////

var chart =
  ui.Chart.image.doySeriesByYear({
      imageCollection: SST_SSTA_Datasets,
      bandName: 'SST_AVE', //Monthly Mean SST band
      region: geometry,
      scale: 4638.3, // Match the spatial resolution of the dataset in meters
    });

// Set chart style properties
var chartStyle = {
  title: 'Monthly Mean Sea Surface Temperature (GCOM-C)',
  hAxis: {
    title: 'Day of Year',
    titleTextStyle: {italic: false, bold: true}
  },
  vAxis: {
    title: 'SST (°C)',
    titleTextStyle: {italic: false, bold: true},
  },
  lineWidth: 3,
  pointSize: 4,
  interpolateNulls: true,
  colors: ['d9ed92', '99d98c', '52b69a', '168aad', '1e6091', '184e77']
};

// Apply style properties to the chart
chart.setOptions(chartStyle);

print(chart);

///////////////////////
// SST Anomaly Chart //
///////////////////////

var chart =
  ui.Chart.image.doySeriesByYear({
      imageCollection: SST_SSTA_Datasets,
      bandName: 'SST_AVE_1', //SSTA band
      region: geometry,
      scale: 4638.3, // Match the spatial resolution of the dataset in meters
    });

// Set chart style properties
var chartStyle = {
  title: 'Monthly Sea Surface Temperature Anomalies (GCOM-C)',
  hAxis: {
    title: 'Day of Year',
    titleTextStyle: {italic: false, bold: true}
  },
  vAxis: {
    title: 'SST Anomaly (Change in °C)',
    titleTextStyle: {italic: false, bold: true},
  },
  lineWidth: 3,
  pointSize: 4,
  interpolateNulls: true,
  colors: ['d9ed92', '99d98c', '52b69a', '168aad', '1e6091', '184e77']
};

// Apply style properties to the chart
chart.setOptions(chartStyle);

print(chart);

///////////////////////////////////////
// SST and Coral Bleaching Threshold //
///////////////////////////////////////
// Methods from this section follow NOAA's Coral Reef Watch "Bleaching Threshold Tutorial"
// You can read about NOAA CRW's methods in more depth here: https://coralreefwatch.noaa.gov/satellite/education/tutorial/crw22_bleachingthreshold.php 
// Looking at our "Monthly Mean Sea Surface Temperature (GCOM-C)" chart, we see that the Maximum Mopnthly Mean (MMM) for our study area is August.
// Averaging August 2018-2022 SST, that value is 30.148, which we will use as our Bleaching Threshold below.

// Create a function to add a new band with the MMM to use as the bleaching threshold
function addBT(image) {
  var sstbleach = image.select('SST_AVE').multiply(0).add(30.148).rename('Bleaching_Threshold');
  return image.addBands(sstbleach, null, true);
}

// Apply the addBT function to our SST dataset. This new dataset will have both the SST and bleaching threshold bands.
var STT_BT = gcomc_merged.map(addBT);

// View both bands in the image collection
// print(STT_BT)

var July2023 = STT_BT
  .filterDate('2023-07-01', '2023-07-31');

/////////////////////////////////////////////
// SST and Coral Bleaching Threshold Chart //
/////////////////////////////////////////////

// Define the chart and print it to the console
var chart =
    ui.Chart.image
        .doySeries({
          imageCollection: July2023,
          region: geometry,
          regionReducer: ee.Reducer.mean(),
          scale: 4638.3, // Match the spatial resolution of the dataset in meters
          yearReducer: ee.Reducer.mean(),
          startDay: 1,
          endDay: 365
        })
        .setSeriesNames(['Bleaching_Threshold', 'SST_AVE']);

// Set chart style properties.
var chartStyle = {
  title: 'July 2023 SST and Bleaching Threshold for Southern Florida Coral (GCOM-C)',
  hAxis: {
    title: 'Day of Year',
    titleTextStyle: {italic: false, bold: true},
  },
  vAxis: {
    title: 'SST (°C)',
    titleTextStyle: {italic: false, bold: true},
  },
  series: {
    0: {lineWidth: 2, color: 'c44536', lineDashStyle: [4, 4]},
    1: {lineWidth: 3, color: '184e77', pointSize: 4}
  },
  interpolateNulls: true
};

// Apply custom style properties to the chart
chart.setOptions(chartStyle);

// Print the chart to the console
print(chart);

//////////////////////////////
// Adding Layers to the Map //
//////////////////////////////

// Add our geometry to show the study area
Map.addLayer(geometry, {}, 'Study Area', false);

// SST
//Load SST data and filter to July 2023
var SST_map = gcomcv3
  .select('SST_AVE') // select SST band
  .filterDate('2023-07-01', '2023-07-31')
  .mean()
  .clip(geometry);

//Set SST Visual Parameters
var SSTvis = {
  min: 29,
  max: 33,
  palette: ['577590', '43aa8b', '90be6d', 'f9c74f', 'f8961e', 'f3722c', 'f94144'],
};

// Add Layer to Map
Map.addLayer(SST_map, SSTvis, 'Sea Surface Temperature');

// SST Anomaly
//Load SST Anomaly data and filter to July 2023
var SSTA_map = SST_SSTA_Datasets
  .select('SST_AVE_1') // select SST Anomaly band
  .filterDate('2023-07-01', '2023-07-31')
  .mean()
  .clip(geometry);

//Set SST Anomaly Visual Parameters
var SSTAvis = {
  min: -2,
  max: 2,
palette: ['283d3b', '197278', 'edddd4', 'c44536', '772e25']
};

// Add Layer to Map
Map.addLayer(SSTA_map, SSTAvis, 'Sea Surface Temperature Anomaly');

// Heat Stress
// Using the Blech Threshold of 30.148, this layer will show any area above the bleaching
// threshold in red, and anything below the bleaching threshold in white

// Define an SLD style of discrete intervals to apply to the image
var sld_intervals =
  '<RasterSymbolizer>' +
    '<ColorMap type="intervals" extended="false" >' +
      '<ColorMapEntry color="#ffffff" quantity="0" label="0"/>' +
      '<ColorMapEntry color="#ffffff" quantity="30.148" label="30.148"/>' + // Anything below the bleaching threshold will be white
      '<ColorMapEntry color="#a34646" quantity="40" label="40" />' + // Anthing above the bleaching threshold will be red
    '</ColorMap>' +
  '</RasterSymbolizer>';

// Add the image to the map using the intervals
Map.addLayer(SST_map.sldStyle(sld_intervals), {}, 'Coral Heat Stress', 0);

// Allen Coral Atlas //
// Add Allen Coral Atlas data
var allencorals = ee.Image('ACA/reef_habitat/v2_0');

// The visualizations are baked into the image properties

// Reef extent classification
var reefExtent = allencorals.select('reef_mask').selfMask();
Map.addLayer(reefExtent, {}, 'Global Reef Extent', false);

// Geomorphic zonation classification
var geomorphicZonation = allencorals.select('geomorphic').selfMask();
Map.addLayer(geomorphicZonation, {}, 'Geomorphic Zonation', false);

// Benthic habitat classification
var benthicHabitat = allencorals.select('benthic').selfMask();
Map.addLayer(benthicHabitat, {}, 'Benthic Habitat');

// End of code
