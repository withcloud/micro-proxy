const { resolve, URL } = require('url')
const fetch = require('node-fetch')
const lintRules = require('./lint-rules')

module.exports = (rules) => {
  const lintedRules = lintRules(rules).map(({pathname, pathnameRe, method, dest, headers}) => {
    const methods = method ? method.reduce((final, c) => {
      final[c.toLowerCase()] = true
      return final
    }, {}) : null

    return {
      pathname,
      pathnameRegexp: new RegExp(pathnameRe || pathname || '.*'),
      dest,
      methods,
      headers
    }
  })

  const getRoute = (req) => {
    for (const { pathname, pathnameRegexp, methods, dest, headers } of lintedRules) {
      if (pathnameRegexp.test(req.url) && (!methods || methods[req.method.toLowerCase()])) {
        return {
          dest,
          headers,
          pathname,
          pathnameRegexp
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

async function proxyRequest (req, res, { dest, reqHeaders, pathname }) {
  const tempUrl = resolve(dest, req.url)
  const cleanUrl = new URL(tempUrl)
  const newUrl = resolve(dest, `${pathname ? cleanUrl.pathname.replace(/^\/[^/]+/, '') : cleanUrl.pathname}${cleanUrl.search}`)
  const url = new URL(dest)
  const proxyRes = await fetch(newUrl, {
    method: req.method,
    headers: Object.assign({ 'x-forwarded-host': req.headers.host }, req.headers, reqHeaders, { host: url.host }),
    body: req,
    compress: false,
    redirect: 'manual'
  })

  // Forward status code
  res.statusCode = proxyRes.status

  // Forward headers
  const headers = proxyRes.headers.raw()
  for (const key of Object.keys(headers)) {
    res.setHeader(key, headers[key])
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
