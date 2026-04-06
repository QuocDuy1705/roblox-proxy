const express = require("express")
const app = express()

const ALLOWED_ASSET_TYPES = [2, 11, 12, 34]

app.use((req, res, next) => {
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`)
    next()
})

app.get("/", (req, res) => res.json({ status: "ok" }))

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
        res.status(500).json({ error: e.message })
    }
})

// Fetch tất cả passes do userId tạo ra (tìm qua tất cả games của user)
app.get("/passes/user/:userId", async (req, res) => {
    const userId = parseInt(req.params.userId)
    if (isNaN(userId)) return res.status(400).json({ error: "Invalid userId" })

    try {
        // Bước 1: Lấy danh sách games của user
        const gamesUrl = `https://games.roblox.com/v2/users/${userId}/games?limit=50&sortOrder=Asc`
        const gamesRes = await fetch(gamesUrl)
        if (!gamesRes.ok) return res.json({ data: [], total: 0 })

        const gamesData = await gamesRes.json()
        const games = gamesData.data || []

        // Bước 2: Với mỗi game, fetch passes
        const allPasses = []
        for (const game of games) {
            const universeId = game.id
            let cursor = ""
            do {
                const url = `https://games.roblox.com/v1/games/${universeId}/game-passes?sortOrder=Asc&limit=100&cursor=${cursor}`
                const r = await fetch(url)
                if (!r.ok) break
                const data = await r.json()
                if (data.data) {
                    // Chỉ lấy passes do đúng userId tạo, giá > 0
                    const valid = data.data.filter(p =>
                        p.seller &&
                        p.seller.id === userId &&
                        p.price != null &&
                        p.price > 0
                    )
                    allPasses.push(...valid)
                }
                cursor = data.nextPageCursor || ""
            } while (cursor)
        }

        res.json({ data: allPasses, total: allPasses.length })
    } catch (e) {
        console.error(e)
        res.status(500).json({ error: e.message })
    }
})

const PORT = process.env.PORT || 3000
app.listen(PORT, "0.0.0.0", () => console.log(`Running on port ${PORT}`))
