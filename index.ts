import Discord from 'discord.js';

import fs from 'fs';

import config from './config';

import BotClient from './utils/classes/BotClient';
import CommandHelpers from './utils/classes/CommandHelpers';
import DatabaseHandler from './utils/classes/DatabaseHandler';

import CommandFile from './utils/interfaces/CommandFile';
import CommandInstance from './utils/interfaces/CommandInstance';

const client = new BotClient();

export const commands: CommandInstance[] = [];
export const registeredCommands: CommandInstance[] = [];

async function readCommands(path?: string) {
    if(!path) path = "./commands";
    let files = await fs.promises.readdir(path);
    for(let i = 0; i < files.length; i++) {
        let file = files[i];
        if(!file.includes(".")) {
            await readCommands(`${path}/${file}`);
        } else {
            file = file.replace(".ts", ".js"); // This is here because when it compiles to JS, it saves to the build directory, and it starts as build/index.js, so it's reading files in build/commands, hence the string change
            let commandFile = require(`${path}/${file}`).default as CommandFile; // .default cause when you call "export default <x>" it adds a default property to it (idk why)
            try {
                let command = {
                    file: commandFile,
                    name: file.split('.')[0],
                    slashData: commandFile.slashData,
                    commandData: commandFile.commandData
                }
                commands.push(command);
            } catch(e) {
                console.error(`Couldn't load the command data for the ${file.split('.')[0]} command with error: ${e}`);
            }
        }
    }
}

export async function registerSlashCommands(reload?: boolean) {
    if(reload) {
        commands.length = 0;
        await readCommands();
    }
    let slashCommands = [];
    for(let i = 0; i < commands.length; i++) {
        registeredCommands.push(commands[i]);
        let commandData;
        try {
            commandData = commands[i].slashData.toJSON()
            slashCommands.push(commandData);
        } catch(e) {
            console.error(`Couldn't load the slash command data for the ${commands[i].name} command with error: ${e}`);
        }
    }
    let rest = new Discord.REST().setToken(config.DISCORD_TOKEN);
    try {
        await rest.put(Discord.Routes.applicationCommands(client.user.id), {body: slashCommands});
    } catch(e) {
        console.error(`There was an error while registering slash commands: ${e}`);
    }
}

client.once("ready", async() => {
    console.log(`Logged into the Discord account - ${client.user.tag}`);
    if(client.application.botPublic) {
        console.warn("BOT IS PUBLIC | SHUTTING DOWN");
        return process.exit();
    }
    await readCommands();
    await registerSlashCommands();
});

client.on('interactionCreate', async(interaction: Discord.Interaction) => {
    if(interaction.type !== Discord.InteractionType.ApplicationCommand) return;
    let command = interaction.commandName.toLowerCase();
    for(let i = 0; i < commands.length; i++) {
        if(commands[i].name === command) {
            await interaction.deferReply({ephemeral: commands[i].commandData.isEphemeral});
            let args = CommandHelpers.loadArguments(interaction);
            if(!CommandHelpers.checkPermissions(commands[i].file, interaction.member as Discord.GuildMember)) {
                let embed = client.embedMaker({title: "No Permission", description: "You don't have permission to run this command", type: "error", author: interaction.user});
                await interaction.editReply({embeds: [embed]});
                return;
            }
            try {
                await commands[i].file.run(interaction, client, args);
            } catch(e) {
                let embed = client.embedMaker({title: "Error", description: "There was an error while trying to run this command. The error has been logged in the console", type: "error", author: interaction.user});
                await interaction.editReply({embeds: [embed]});
                console.error(e);
            }
        }
    }
});

client.on('interactionCreate', async(interaction: Discord.Interaction) => {
    if(interaction.type !== Discord.InteractionType.MessageComponent) return;
    await interaction.deferReply({ephemeral: true});
    let roleIDsRequired = config.permissions.designate.concat(config.permissions.all);
    if(!(interaction.member.roles as Discord.GuildMemberRoleManager).cache.some(role => roleIDsRequired.includes(role.id))) {
        let embed = client.embedMaker({title: "No Permission", description: "You don't have permission to run this command", type: "error", author: interaction.user});
        await interaction.editReply({embeds: [embed]});
        return;
    }
    let button = interaction as Discord.ButtonInteraction;
    let userInfoValue = button.message.embeds[0].fields[0].value;
    userInfoValue = userInfoValue.substring(userInfoValue.indexOf("Roblox ID:"));
    userInfoValue = userInfoValue.substring(0, userInfoValue.indexOf("\n"));
    let robloxID = Number(userInfoValue.substring(userInfoValue.indexOf(":") + 2));
    if(button.customId === "designate") {
        if(await DatabaseHandler.isMarked(robloxID)) {
            let embed = client.embedMaker({title: "User Already Designated", description: "This user has already been designated as a threat", type: "error", author: interaction.user});
            return await interaction.editReply({embeds: [embed]});
        }
        await DatabaseHandler.mark(robloxID);
        let embed = client.embedMaker({title: "Designation Successful", description: "Successfully designated this user as a threat", type: "success", author: interaction.user});
        return await interaction.editReply({embeds: [embed]});
    } else {
        if(!await DatabaseHandler.isMarked(robloxID)) {
            let embed = client.embedMaker({title: "User Not Designated", description: "This user has not been designated as a threat", type: "error", author: interaction.user});
            return await interaction.editReply({embeds: [embed]});
        }
        await DatabaseHandler.unmark(robloxID);
        let embed = client.embedMaker({title: "Undesignation Successful", description: "Successfully undesignated this user as a threat", type: "success", author: interaction.user});
        return await interaction.editReply({embeds: [embed]});
    }
});

client.login(config.DISCORD_TOKEN);