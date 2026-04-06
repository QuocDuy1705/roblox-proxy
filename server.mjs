import http from "http"
import { URL } from "url"

import { getAllGamePasses } from "./publicassets.mjs"

const PORT = Number(process.env.PORT ?? 3000)

function writeJson(res, status, payload) {
    res.writeHead(status, {
        "Content-Type": "application/json; charset=utf-8",
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type",
    })

    res.end(JSON.stringify(payload))
}

const server = http.createServer(async (req, res) => {
    if (req.method === "OPTIONS") {
        res.writeHead(204)
        res.end()
        return
    }

    const reqUrl = new URL(req.url, `http://${req.headers.host}`)

    if (req.method === "GET" && reqUrl.pathname === "/health") {
        writeJson(res, 200, { ok: true })
        return
    }

    if (req.method === "GET" && reqUrl.pathname === "/api/gamepasses") {
        const userId = Number(reqUrl.searchParams.get("userId"))

        if (!Number.isInteger(userId) || userId <= 0) {
            writeJson(res, 400, { error: "userId must be a positive integer." })
            return
        }

        try {
            const data = await getAllGamePasses(userId)
            writeJson(res, 200, {
                userId,
                fetchedAt: new Date().toISOString(),
                data,
            })
        } catch (error) {
            writeJson(res, 500, {
                error: "Failed to fetch gamepasses.",
                message: error instanceof Error ? error.message : String(error),
            })
        }

        return
    }

    writeJson(res, 404, { error: "Not found." })
})

server.listen(PORT, () => {
    console.log(`Gamepass API listening on http://localhost:${PORT}`)
})
