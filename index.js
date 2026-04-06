const express = require("express")
const app = express()

const ALLOWED_ASSET_TYPES = [2, 11, 12, 34]

app.use((req, res, next) => {
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`)
    next()
})

// Health check
app.get("/", (req, res) => {
    res.json({ status: "ok" })
})

// Fetch inventory (T-Shirt, Shirt, Pants)
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
        console.error(e)
        res.status(500).json({ error: e.message })
    }
})

// Fetch passes của 1 experience, filter theo userId
app.get("/passes/:universeId/user/:userId", async (req, res) => {
    const universeId = parseInt(req.params.universeId)
    const userId     = parseInt(req.params.userId)

    if (isNaN(universeId) || isNaN(userId)) {
        return res.status(400).json({ error: "Invalid params" })
    }

    try {
        const all = []
        let cursor = ""
        do {
            const url = `https://games.roblox.com/v1/games/${universeId}/game-passes?sortOrder=Asc&limit=100&cursor=${cursor}`
            const r = await fetch(url)
            if (!r.ok) break
            const data = await r.json()
            if (data.data) all.push(...data.data)
            cursor = data.nextPageCursor || ""
        } while (cursor)

        // Chỉ giữ passes do đúng userId tạo, đang for sale, giá > 0
        const owned = all.filter(p =>
            p.seller &&
            p.seller.id === userId &&
            p.price != null &&
            p.price > 0
        )

        res.json({ data: owned, total: owned.length })
    } catch (e) {
        console.error(e)
        res.status(500).json({ error: e.message })
    }
})

const PORT = process.env.PORT || 3000
app.listen(PORT, "0.0.0.0", () => console.log(`Running on port ${PORT}`))
