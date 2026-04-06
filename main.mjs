import { getPublicAssets, getAllGamePasses } from "./publicassets.mjs"

import { performance } from 'perf_hooks'



const start = performance.now()

const userId = Number(process.argv[2])
const mode = process.argv[3] ?? "public-assets"

if (!Number.isInteger(userId) || userId <= 0) {
    console.log("Usage: node main.mjs <userId> [public-assets|gamepasses]")
    process.exit(1)
}

let result
if (mode === "gamepasses") {
    result = await getAllGamePasses(userId)
} else if (mode === "public-assets") {
    result = await getPublicAssets(userId)
} else {
    console.log("Invalid mode. Use: public-assets or gamepasses")
    process.exit(1)
}

console.log(result)

console.log(`\nRuntime: ${(performance.now() - start) / 1000} seconds.`)

