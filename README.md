## Live crawler

Crawl Streamr network topologies on demand.

Consider this a prototype, TODO:
- tests
- ability to cancel requests
- configurability to different Streamr networks

## Install and run

1. Run `npm install`
2. Run `npm run build`
3. Run `node dist/index.js`
4. Open index.html (in project root) with your favorite browser, pass `?streamId=<YOUR_STREAM_ID>` as a query parameter to fetch a topology for the specified streamId
