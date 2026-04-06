const express = require("express")
const app = express()

const ALLOWED_ASSET_TYPES = [2, 11, 12, 34]
const ROBLOX_API_KEY = process.env.ROBLOX_API_KEY

app.use((req, res, next) => {
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`)
    next()
})

app.get("/", (req, res) => res.json({ status: "ok" }))

app.get("/inventory/:userId/:assetType/all", async (req, res) => {
    const userId    = parseInt(req.params.userId)
    const assetType = parseInt(req.params.assetType)
    if (isNaN(userId) || !ALLOWED_ASSET_TYPES.includes(assetType)) {
        return res.status(400).json({ error: "Invalid params" })
    }
    try {
        const all = []
        let cursor = ""
        do {
            const url = `https://inventory.roblox.com/v2/users/${userId}/inventory/${assetType}?limit=100&sortOrder=Asc&cursor=${cursor}`
            const r = await fetch(url)
            if (!r.ok) break
            const data = await r.json()
            if (data.data) all.push(...data.data)
            cursor = data.nextPageCursor || ""
        } while (cursor)
        res.json({ data: all, total: all.length })
    } catch (e) {
        res.status(500).json({ error: e.message })
    }
})

app.get("/passes/:universeId/user/:userId", async (req, res) => {
    const universeId = parseInt(req.params.universeId)
    const userId     = parseInt(req.params.userId)
    if (isNaN(universeId) || isNaN(userId)) {
        return res.status(400).json({ error: "Invalid params" })
    }
    if (!ROBLOX_API_KEY) {
        return res.status(500).json({ error: "API key not configured" })
    }
    try {
        const all = []
        let cursor = ""
        do {
            // Thử đúng endpoint Open Cloud
            const url = `https://apis.roblox.com/cloud/v2/universes/${universeId}/game-passes?maxPageSize=100${cursor ? "&pageToken=" + cursor : ""}`
            const r = await fetch(url, {
                headers: { "x-api-key": ROBLOX_API_KEY }
            })

            const rawText = await r.text()
            console.log("Status:", r.status)
            console.log("Response:", rawText)

            if (!r.ok) break

            const data = JSON.parse(rawText)
            const items = data.gamePasses || data.gamePassess || data.data || []
            all.push(...items)
            cursor = data.nextPageToken || data.nextPageCursor || ""
        } while (cursor)

        // Filter theo userId
        const owned = all.filter(p => {
            const creatorId = p.creatorId || (p.creator && p.creator.id)
            const price = p.price || p.priceInRobux
            return creatorId === userId && price && price > 0
        })

        res.json({ data: owned, total: owned.length, raw_total: all.length })
    } catch (e) {
        console.error(e)
        res.status(500).json({ error: e.message })
    }
})

const PORT = process.env.PORT || 3000
app.listen(PORT, "0.0.0.0", () => console.log(`Running on port ${PORT}`))
