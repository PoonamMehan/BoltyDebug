import {createSlice} from '@reduxjs/toolkit'

const initialState = {
    initialFiles: [],
    messages: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    promptsArr: [0, 0, 0, 0, 0],
    changedFiles: [],
    chatMsgHistory: [],
    allFilesInWC: [],
    iframeURL: null,
}

const filesAndFoldersSlice = createSlice({
    name: "filesAndFolders",
    initialState,
    reducers: {
        addInitialFiles: (state, action) => {
            state.initialFiles = action.payload
            sessionStorage.setItem("initialFiles", action.payload)
        },
        addMessages: (state, action) => {
            state.messages = action.payload
            sessionStorage.setItem("messages", action.payload)
        },
        managePromptsArr: (state, action) => {
            state.promptsArr = action.payload
            sessionStorage.setItem("promptsArr", action.payload)
        },
        manageChangedFiles: (state, action) => { //take care of this
            state.changedFiles = action.payload
            sessionStorage.setItem("changedFiles", action.payload)
        },
        manageChatMsgHistory: (state, action)=>{
            state.chatMsgHistory = action.payload
            sessionStorage.setItem("chatMsgHistory", action.payload)
        },// inital prompt -> initial response -> subsequent prompts and responses
        manageAllFilesInWC: (state, action)=>{
            state.allFilesInWC = action.payload
        },
        // setTerminalInstance: (state, action)=>{
        //     console.log("here 6", action.payload)
        //     state.terminalInstance = action.payload
        //     //not saving in session storage
        //     //handle this on refresh using npm install and npm run dev again running and populating this array again
        // },
        // setTerminalRef: (state, action)=>{
        //     state.terminalRef = action.payload
        // }
        
        setIframeURL: (state, action)=>{
            state.iframeURL = action.payload
        }
    }
})

export default filesAndFoldersSlice.reducer;
export const {addInitialFiles, addMessages, managePromptsArr, manageChangedFiles, manageChatMsgHistory, manageAllFilesInWC, setIframeURL} = filesAndFoldersSlice.actions;