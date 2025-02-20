const fs = require('fs')
const path = require('path')
const isoData = require('../src/iso-3166-data.json')

const uniqueRegions = new Set()

isoData.forEach(country => {
  if (country['sub-region']) {
    uniqueRegions.add(country['sub-region'])
  }
})


const regions = Array.from(uniqueRegions).sort()
console.log(regions)