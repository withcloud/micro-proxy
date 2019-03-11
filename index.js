const { resolve, URL } = require('url')
const fetch = require('node-fetch')
const lintRules = require('./lib/lint-rules')

module.exports = (rules) => {
  const lintedRules = lintRules(rules).map(({ pathname, pathnameRe, method, dest, headers, replace }) => {
    const methods = method ? method.reduce((final, c) => {
      final[c.toLowerCase()] = true
      return final
    }, {}) : null

    return {
      pathname,
      pathnameRegexp: new RegExp(pathnameRe || pathname || '.*'),
      dest,
      methods,
      headers,
      replace
    }
  })

  const getRoute = (req) => {
    for (const { pathname, pathnameRegexp, methods, dest, headers, replace } of lintedRules) {
      if (pathnameRegexp.test(req.url) && (!methods || methods[req.method.toLowerCase()])) {
        return {
          dest,
          headers,
          pathname,
          pathnameRegexp,
          replace
        }
      }
    }
    return {}
  }

  return async (req, res) => {
    try {
      const route = getRoute(req)

      if (!route.dest) {
        res.writeHead(404)
        res.end('404 - Not Found')
        return
      }

      await proxyRequest(req, res, route)
    } catch (err) {
      console.error(err.stack)
      res.end()
    }
  }
}

async function proxyRequest (req, res, { dest, headers, replace }) {
  const tempUrl = resolve(dest, req.url)
  const cleanUrl = new URL(tempUrl)
  let newPathname = cleanUrl.pathname
  if (replace) {
    const re = new RegExp(replace.searchValue)
    newPathname = newPathname.replace(re, replace.newValue)
  }
  const newUrl = resolve(dest, `${newPathname}${cleanUrl.search}`)
  const url = new URL(dest)
  const proxyRes = await fetch(newUrl, {
    method: req.method,
    headers: Object.assign({ 'x-forwarded-host': req.headers.host }, req.headers, headers, { host: url.host }),
    body: req.body,
    compress: false,
    redirect: 'manual'
  })

  // Forward status code
  res.statusCode = proxyRes.status

  // Forward headers
  const newHeaders = proxyRes.headers.raw()
  for (const key of Object.keys(newHeaders)) {
    res.setHeader(key, newHeaders[key])
  }

  // Stream the proxy response
  proxyRes.body.pipe(res)
  proxyRes.body.on('error', (err) => {
    console.error(`Error on proxying url: ${newUrl}`)
    console.error(err.stack)
    res.end()
  })

  req.on('abort', () => {
    proxyRes.body.destroy()
  })
}
