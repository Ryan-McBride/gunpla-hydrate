'use strict';
const jsdom = require('jsdom/lib/old-api.js');
const a = require('async');
const fs = require('fs');
const request = require('request');

const pages = [
  'http://gundam.wikia.com/wiki/High_Grade_Universal_Century',
  'http://gundam.wikia.com/wiki/High_Grade_Gunpla_Builders',
  'http://gundam.wikia.com/wiki/High_Grade_Build_Fighters',
  'http://gundam.wikia.com/wiki/High_Grade_Build_Custom',
  'http://gundam.wikia.com/wiki/High_Grade_Gundam_Thunderbolt',
  'http://gundam.wikia.com/wiki/High_Grade_Gundam_The_Origin',
  'http://gundam.wikia.com/wiki/High_Grade_Fighting_Action',
  'http://gundam.wikia.com/wiki/High_Grade_Gundam_SEED',
  'http://gundam.wikia.com/wiki/High_Grade_Gundam_00',
  'http://gundam.wikia.com/wiki/High_Grade_Gundam_AGE',
  'http://gundam.wikia.com/wiki/High_Grade_Reconguista_In_G',
  'http://gundam.wikia.com/wiki/High_Grade_IRON-BLOODED_ORPHANS',
  'http://gundam.wikia.com/wiki/High_Grade_IRON-BLOODED_ARMS'
]
let dest = process.env.dest || '';
let output = [];
let images = [];
let changedFlag = false;

if(fs.existsSync(dest+'gunpla.json')){
  output = JSON.parse(fs.readFileSync(dest+'gunpla.json'));
}

a.eachLimit(pages, 1, function(val, done){
  jsdom.env(
    val,
    ["http://code.jquery.com/jquery.js"],
    (errors, window)=>{
      window.$(".tabbertab tr").each(function(){
        let count = 0
        let data = {
          image: '',
          wikiImage: '',
          name: '',
          wiki: ''
        }
        window.$(this).children('td').each(function(){
          let text = window.$(this).text();
          if(!count){
            let image = text;
            image = image.replace(/^.*src="/, '');
            image = image.replace(/\/revision.*/, '');
            if(image.indexOf('http') === -1){
              data.image = 'https://s3-us-west-1.amazonaws.com/gunpla/image-not-available.jpg';
            } else {
              image = image.replace(/\n/, '');
              data.wikiImage = image;
              image = image.replace(/^.*\//, '');
              data.image = 'https://s3-us-west-1.amazonaws.com/gunpla/'+image;
            }
          } else if (count === 1){
            text = text.replace(/(^ )/, '').replace(/\n/, '');
            data.name = encodeURIComponent(text);
            data.wiki = 'http://gundam.wikia.com'+window.$(this).find('a').attr('href');
          }
          count++;
        })
        if(data.name){
          insert(data);
        }
      })
      done();
    }
  );
},function(){
  if(changedFlag){
    writeJSON(output);
    downloadImages(function(){
      console.log('complete')
    });
  } else {
    console.log('no changes detected')
  }
});

function insert(record) {
  if(output.length !== 0){
    let index = indInFile(record.name);
    if(index !== -1){
      let unavailable = 'https://s3-us-west-1.amazonaws.com/gunpla/image-not-available.jpg';
      if((output[index].image !== record.image) && (output[index].image === unavailable)){
        output[index] = record;
        changedFlag = true;
        images.push(record.wikiImage);
        log(record);
      }
    } else {
      output.push(record);
      changedFlag = true;
      images.push(record.wikiImage);
      log(record);
    }
  } else {
    changedFlag = true;
    output.push(record);
    images.push(record.wikiImage);
    log(record);
  }
};

function indInFile(name){
  let index = -1;
  output.forEach(function(val, ind){
    if(val.name === name) index = ind;
  })
  return index
}

function writeJSON (obj) {
  console.log('changes detected, creating new file');
  if(fs.existsSync(dest+'gunpla.json')){
    let date = new Date();
    fs.renameSync(dest+'gunpla.json', date+'gunpla.json')
  }
  fs.writeFileSync(dest+'gunpla.json', JSON.stringify(obj));
}

function download(uri, filename, callback){
  request.head(uri, function(err, res, body){
    console.log('content-type:', res.headers['content-type']);
    console.log('content-length:', res.headers['content-length']);
    request(uri).pipe(fs.createWriteStream(filename)).on('close', callback);
  });
};

function downloadImages(cb){
  console.log('NUMBER OF IMAGES', images.length);
  if(!fs.existsSync('images')){
    fs.mkdirSync('images');
  }
  a.eachLimit(images, 1, function(val, done){
    if(val && val.indexOf('http') !== -1){
      val = val.substring(val.indexOf('http'), val.length);
      console.log('downloading', val);
      let filename = val.replace(/^.*\//, '');
      download(val, 'images/'+filename, done); 
    } else {
      done();
    }
  }, function(){
    console.log('downloadedd');
    cb();
  });
}

function log(record){
  fs.appendFileSync('gunpla.log', ''+new Date()+' '+JSON.stringify(record)+'\n');
}
