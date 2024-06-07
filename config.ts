import BotConfig from "./utils/interfaces/BotConfig";

require('dotenv').config();

export const envValues = ["DISCORD_TOKEN"];
for(let i = 0; i < envValues.length; i++) {
    if(!process.env[envValues[i]]) {
        console.log(`${envValues[i]} not defined in .env file`);
        process.exit(1);
    }
}

const config: BotConfig = {
    DISCORD_TOKEN: process.env.DISCORD_TOKEN,
    permissions: {
        all: ["759959415708450837"],
        fetch: [],
        designate: []
    },
    embedColors: {
        info: "Blue",
        success: "Green",
        error: "Red"
    },
}

export default config;