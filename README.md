## Live crawler

Crawl Streamr network topologies on demand.

Crawling logic copied from https://github.com/streamr-dev/stream-metrics-index.

Consider this a prototype, TODO:
- tests
- ability to cancel requests
- configurability to different Streamr networks
- streaming results (for big streams)

## Install and run
```shell
npm install
npm run build
npm run start
```

Navigate to http://localhost:3000

### ISO-3166-data.json

The file iso-3166-data.json is from https://github.com/lukes/ISO-3166-Countries-with-Regional-Codes by
Luke Duncalfe and licensed under the [Creative Commons Attribution-ShareAlike 4.0 International License](https://creativecommons.org/licenses/by-sa/4.0/).

In case of updating the file, make sure to run `extract-regions.js` to extract the unique sub-regions. Then make sure to update the `regionColorMap` in `public/main.js` with the new colors.