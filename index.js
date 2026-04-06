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

// Fetch passes của user qua catalog + economy API
app.get("/passes/user/:userId", async (req, res) => {
    const userId = parseInt(req.params.userId)
    if (isNaN(userId)) return res.status(400).json({ error: "Invalid userId" })

    try {
        // Bước 1: Lấy danh sách pass ID từ catalog
        const allIds = []
        let cursor = ""
        do {
            const url = `https://catalog.roblox.com/v1/search/items?category=GamePass&creatorTargetId=${userId}&creatorType=User&limit=30${cursor ? "&cursor=" + cursor : ""}`
            const r = await fetch(url)
            if (!r.ok) break
            const data = await r.json()
            if (data.data) {
                for (const item of data.data) {
                    if (item.id) allIds.push(item.id)
                }
            }
            cursor = data.nextPageCursor || ""
        } while (cursor)

        if (allIds.length === 0) {
            return res.json({ data: [], total: 0 })
        }

        // Bước 2: Batch fetch details (tên, giá, icon) từng 30 items
        const allPasses = []
        for (let i = 0; i < allIds.length; i += 30) {
            const batch = allIds.slice(i, i + 30)
            const ids = batch.map(id => `itemIds=${id}`).join("&")
            const url = `https://economy.roblox.com/v2/assets/prices?assetType=GamePass&${ids}`
            const r = await fetch(url)
            if (!r.ok) continue
            const priceData = await r.json()

            // Fetch tên + icon riêng
            const detailUrl = `https://catalog.roblox.com/v1/catalog/items/details`
            const detailRes = await fetch(detailUrl, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    items: batch.map(id => ({ itemType: "Asset", id }))
                })
            })
            if (!detailRes.ok) continue
            const detailData = await detailRes.json()

            if (detailData.data) {
                for (const item of detailData.data) {
                    if (item.price && item.price > 0) {
                        allPasses.push({
                            id:           item.id,
                            name:         item.name,
                            price:        item.price,
                            imageAssetId: item.thumbnail || null,
                        })
                    }
                }
            }
        }

        res.json({ data: allPasses, total: allPasses.length })
    } catch (e) {
        console.error(e)
        res.status(500).json({ error: e.message })
    }
})

const PORT = process.env.PORT || 3000
app.listen(PORT, "0.0.0.0", () => console.log(`Running on port ${PORT}`))
