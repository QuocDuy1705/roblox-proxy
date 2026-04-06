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

// Fetch passes của user — tìm qua tất cả games của user + groups
app.get("/passes/user/:userId", async (req, res) => {
    const userId = parseInt(req.params.userId)
    if (isNaN(userId)) return res.status(400).json({ error: "Invalid userId" })

    try {
        const allPasses = []

        // 1. Lấy games của user
        const userGames = await getGames(userId, "users")

        // 2. Lấy groups của user → lấy games của từng group
        const groupIds = await getGroupIds(userId)
        const groupGames = []
        for (const groupId of groupIds) {
            const games = await getGames(groupId, "groups")
            groupGames.push(...games)
        }

        // 3. Fetch passes từ tất cả games
        const allGames = [...userGames, ...groupGames]
        for (const game of allGames) {
            const passes = await getPasses(game.id, userId)
            allPasses.push(...passes)
        }

        res.json({ data: allPasses, total: allPasses.length })
    } catch (e) {
        console.error(e)
        res.status(500).json({ error: e.message })
    }
})

// Helper: lấy danh sách games
async function getGames(creatorId, creatorType) {
    const all = []
    let cursor = ""
    do {
        const url = `https://games.roblox.com/v2/${creatorType}/${creatorId}/games?accessFilter=2&limit=50&sortOrder=Asc&cursor=${cursor}`
        const r = await fetch(url)
        if (!r.ok) break
        const data = await r.json()
        if (data.data) {
            for (const g of data.data) {
                all.push({ id: g.id, name: g.name })
            }
        }
        cursor = data.nextPageCursor || ""
    } while (cursor)
    return all
}

// Helper: lấy group IDs mà user là owner
async function getGroupIds(userId) {
    const ids = []
    try {
        const url = `https://groups.roblox.com/v1/users/${userId}/groups/roles?includeLocked=false&includeNotificationPreferences=false`
        const r = await fetch(url)
        if (!r.ok) return ids
        const data = await r.json()
        if (data.data) {
            for (const row of data.data) {
                if (row.group && row.group.owner && row.group.owner.userId == userId) {
                    ids.push(row.group.id)
                }
            }
        }
    } catch (e) {
        console.error("getGroupIds error:", e)
    }
    return ids
}

// Helper: lấy passes của 1 universe, filter theo userId
async function getPasses(universeId, userId) {
    const all = []
    let cursor = ""
    do {
        const url = `https://apis.roblox.com/game-passes/v1/universes/${universeId}/game-passes?passView=Full&pageSize=50&pageToken=${cursor}`
        const r = await fetch(url)
        if (!r.ok) break
        const data = await r.json()
        if (data.gamePasses) {
            for (const p of data.gamePasses) {
                // Filter: đúng userId, có giá > 0
                const creatorId = p.creatorId || (p.creator && p.creator.id)
                const price = p.price
                if (creatorId == userId && price && price > 0) {
                    all.push({
                        id:           p.id,
                        name:         p.name,
                        price:        p.price,
                        imageAssetId: p.iconImageId || null,
                    })
                }
            }
        }
        cursor = data.nextPageToken || ""
    } while (cursor)
    return all
}

const PORT = process.env.PORT || 3000
app.listen(PORT, "0.0.0.0", () => console.log(`Running on port ${PORT}`))
