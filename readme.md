# 🛠️ micro-proxy
Same as zeit/micro-proxy but support header, install as `now-micro-proxy`.


> original
>
> https://github.com/withcloud/micro-proxy
> 
> forked from
>
> https://github.com/zeit/micro-proxy/tree/51db13be5c66c12859ebb8f88fa249486966100f
> 
> see also
>
> https://github.com/zeit/micro-proxy/pull/23
>
> https://github.com/zeit/micro-proxy/pull/42


## Why?

當發佈 micro-proxy 到 NOW v2 時會有錯誤

https://spectrum.chat/?t=10f07039-488d-4056-804f-1627d92cc25b


這是解決辦法

https://github.com/zeit/now-cli/issues/1462


所以我需要能用於 micro-proxy 和控制 header 的方法，所以 forked `micro-proxy` 並按照 PR 加上 header 功能。


## How to use


```
yarn add now-micro-proxy
```

index.js

```js
const createProxy = require('now-micro-proxy')
const rules = require('../rules')
const proxy = createProxy(rules)
proxy.listen(3000, (err) => {
  if (err) {
    throw err
  }
  console.log(`> Ready on http://localhost:3000`)
})
```

rules.js

```js
const headers = {
  'cf-connecting-ip': undefined,
  'cf-ipcountry': undefined,
  'cf-visitor': undefined,
  'cf-ray': undefined
}
const env = process.env.VAVAGO_ENV === 'production' ? '' : '-development'
module.exports = [
  { 'pathname': '/api', 'dest': `https://api${env}.getvavago.com`, headers },
  { 'pathname': '/api/**', 'dest': `https://api${env}.getvavago.com`, headers },
  { 'pathname': '/admin', 'dest': `https://admin${env}.getvavago.com`, headers },
  { 'pathname': '/admin/**', 'dest': `https://admin${env}.getvavago.com`, headers },
  { 'dest': `https://site${env}.getvavago.com`, headers }
]
```

