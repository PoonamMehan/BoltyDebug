import axios from 'axios';
import {useState, useEffect} from 'react';
import {useDispatch, useSelector} from 'react-redux';
import { addInitialFiles, addMessages, managePromptsArr, manageChatMsgHistory, manageAllFilesInWC} from '../store/filesAndFoldersSlice.js';
import { accessFileContentFromWC, createFilesInWCFromObj, createFilesInWCUsingArray, getAllCurrentFolderAndFileNamesInWC, runScriptInWC } from '../utils/webCon.js';
import { parseXml } from '../utils/respParser.js';
import {useNavigate} from 'react-router-dom'
import store from '../store/store.js';
import arrow from "./next.png"
import { useOutletContext } from "react-router-dom";


export function Home(){
    const dispatch = useDispatch();
    const navigate = useNavigate()
    const messages = useSelector((state)=>state.filesAndFolders.messages)
    const changedFiles = useSelector((state) => state.filesAndFolders.changedFiles)
    const [initialPrompt, setInitialPrompt] = useState("")
    const {term} = useOutletContext()

    const fabricateLastMsg = async(updatedChangedFiles)=>{
        let msg = ''
        const fileContents = await Promise.all(updatedChangedFiles.map(async (filePath) => {
            let currFileContent = await accessFileContentFromWC(filePath);
            return `${filePath}\n\`\`\`\n${currFileContent}\n\`\`\`\n`;
        }));
        msg += fileContents.join(""); // Join all retrieved contents
        return msg;
    }

    const create = async ()=>{

        try{
        const tempResp = await axios.post('/api/v1/chat/template', {
            prompt: initialPrompt
        })
        
        const initialCodeStructure = tempResp.data.uiPrompts
        //save in store initial code structure, cuz: this structure is in object format and upon refresh, the web app will use this to recreate files in WC
        dispatch(addInitialFiles(initialCodeStructure))

        // creating initial files in the web container
        await createFilesInWCFromObj(initialCodeStructure)

        //saving the fileAndFolderNames present in WC, in store to show in fileExplorer()
        const allFileAndFolderStruct = await getFilesAndFolderNames()
        dispatch(manageAllFilesInWC(allFileAndFolderStruct))

        //storing chatMsgHistory in store to show in the chatBox on the left
        let updatedChatMsgHistory = [{role: "user", msg: initialPrompt}]
        dispatch(manageChatMsgHistory(updatedChatMsgHistory));

        //move to the next page where all the code is showing
        navigate('/current-project');

        //run 'npm install' manually
        //installing it here because package.json is created initially, and if the code files coming from LLm includes package.json, it will run once again before the npm run dev
        console.log("here 1")
        // instance?.writeln('npm install')
        term?.writeln('npm install')
        await runScriptInWC('npm install', term)
        console.log("it comes here")

        //we maintain messges[] in store, it is an array of messages which stores the prompts to web container
        const messagesNew = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0]
        messagesNew[0] = {role: "user", content: tempResp.data.prompts[0]}
        messagesNew[1] = {role: "user", content: "Below is the conversation history, including all previous messages along with the most recent assistant response. Please reference this context to inform your future responses and maintain conversation continuity."}
        messagesNew[2] = {role: "user", content:`Previous Message #1: ${tempResp.data.prompts[1]}`}

        //save this messages array in the store and session storage
        dispatch(addMessages(messagesNew))

        //take the current prompt, add it in the prompts[5] at prompts[0], we maintain a prompts[] to save all tje prompts
        const prompts = [0, 0, 0, 0, 0]
        prompts[0] = initialPrompt

        //save the prompts array in store and session storage
        dispatch(managePromptsArr(prompts))
    
        //main request to /get-code endpoint to generate code
        await fetch('/api/v1/chat/get-code', {

            method: "Post",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({"msgs": tempResp.data.prompts.map((x)=> {return {role: "user", content: x}})})

        }).then(async(res)=>{
            if(!res.ok){
                throw new Error(res)
            }

            console.log("here 2")
            const reader = res.body.getReader()
            const decoder = new TextDecoder()
            let result = ""
            await reader.read().then(async function processText({done, value}){
                if(!done){
                    const text = decoder.decode(value || new Uint8Array(), {stream: true})
                    result += text
                    reader.read().then(processText)
                }else{
                    console.log(result)
                    
                    //save the result in messages[] in store
                    //here we are setting up the messages[], which is maintained to store the prompts data structure which we edit after every request and response to llm, to store 2 things:
                    // 1: upon every request it saves the latest prompt by the user to llm
                    // 2: upon every response from llm, it saves the response from llm in place of the last response to update the messages[] for next request to LLM.
                    const messagesNew2 = messagesNew.map((msg)=> typeof msg === "object"? {...msg} : msg)
                    messagesNew2[3] = {role: "assistant", content: result}

                    //now parse the response and build it inside the WC
                    const parsedResp = parseXml(result)
                    await createFilesInWCUsingArray(parsedResp, changedFiles, term, dispatch)


                    //checking if changedFiles include all the names of the files changed
                    //we maintain a record of changedFiles[] in store(it is set in webCon.js file and used here, hence the need of store), and is used to set up messages[], because the prompts to LLM includes the code of changed files
                    const nowChangedFiles = store.getState().filesAndFolders.changedFiles
                    console.log('ChangedFiles:' , nowChangedFiles)

                    const lastPromptMsg = await fabricateLastMsg(nowChangedFiles);

                    console.log("lastPromptMsg ", lastPromptMsg)
                    // console.log("prompt msg", lastPromptMsg)
                    messagesNew2[4] = {role: "user", content: lastPromptMsg}
                    dispatch(addMessages(messagesNew2))
                    console.log("messagesNew2, final from initial page ", messagesNew2)


                    //chatBox on the left shows converstaion between user and the LLM, the user's prompts is showns as it is, but, the response from LLM isn't shown as it is. We need to insert "Create initial files and 'npm install'" in it
                    //we are creating tht modified message here
                    let modifiedChatMsg = []
                    modifiedChatMsg.push(parsedResp[0]);//initial response text
                    modifiedChatMsg.push(parsedResp[1]);//artifact title
                    modifiedChatMsg.push({type: "CreateFile", title: "Create initial files"})
                    modifiedChatMsg.push({type: "CreateFile", title: "Install dependencies"})
                    modifiedChatMsg.push({type: "RunScript", code: "npm install"})

                    //add rest of the parsedResponse elements
                    let idx=2;
                    while(idx < parsedResp.length){
                        modifiedChatMsg.push(parsedResp[idx])
                        idx++
                    }
                    
                    const updatedChatMsgHistory2 = [...updatedChatMsgHistory]
                    updatedChatMsgHistory2.push({role: "assistant", msg: modifiedChatMsg});
                    dispatch(manageChatMsgHistory(updatedChatMsgHistory2));


                    //since now all the files and folders are created, we need to update the fileExplorer
                    const allFileAndFolderStruct2 = await getFilesAndFolderNames()
                    dispatch(manageAllFilesInWC(allFileAndFolderStruct2))

                    setInitialPrompt("")
            }})
        
        }).catch((err)=>{
            console.log(err);
        }) 

    }catch(err){
        console.log(err)
    }
        
    }

    async function getFilesAndFolderNames(){
        const fullFileFolderStructure = await getAllCurrentFolderAndFileNamesInWC('', 0)
        return fullFileFolderStructure;
    }

    const initialUserPromptInput = (inputPrompt)=>{
        setInitialPrompt(inputPrompt)
    }

    return (
        <>
            <div className="flex min-h-screen min-w-screen items-center justify-center bg-[#0a0a0a]">
                <div className="flex flex-col items-center justify-center text-center absolute inset-0 bg-[radial-gradient(circle_450px_at_20%_-20%,rgba(128,0,255,0.7),rgba(128,0,255,0.2)_60%,transparent_100%)]">
                    <div className="flex flex-col items-center justify-center text-center absolute inset-0 bg-[radial-gradient(circle_450px_at_10%_-45%,rgba(128,0,255,0.7),rgba(128,0,255,0.2)_60%,transparent_100%)]">
                        <div>
                        <p className="text-4xl font-bold text-white mb-4">Ask Asimo to build your next Project</p>
                        <p className="text-gray-400 mb-6">Prompt and build full stack React, NodeJS and NextJS Web Apps.</p>
                    </div>
                    <div className="relative">
                        <div className="w-[550px] max-w-[550px] h-32 rounded-md border border-transparent bg-[#141414] [background:linear-gradient(45deg,#172033,theme(colors.slate.800)_50%,#172033)_padding-box,conic-gradient(from_var(--border-angle),theme(colors.slate.600/.48)_80%,theme(colors.indigo.500)_86%,theme(colors.indigo.300)_90%,theme(colors.indigo.500)_94%,theme(colors.slate.600/.48))_border-box] animate-border">
                            <div className="bg-[#141414] w-[550px] h-32 flex relative rounded-md border-gray-600 border-[1px]">
                                <textarea className="text-white absolute left-3 top-4 focus:outline-none focus:ring-0 h-20 w-[450px] overflow-y-auto break-words resize-none text-lg" type="text" placeholder="Enter your prompt here" onChange={(e) => initialUserPromptInput(e.target.value)} onKeyDown={(e)=>{ 
                                    if(e.key == "Enter" && !e.shiftKey){
                                    e.preventDefault()
                                    create()
                                }}}></textarea>

                                <button className="absolute right-4 top-4" onClick={create}>
                                    <div className="bg-[rgba(128,0,255,0.7)] px-1 py-1 rounded-md">
                                        <img src={arrow} alt="Create" className="w-7" />
                                    </div>
                                </button>
                            </div>
                        </div>
                    </div>
                    </div> 
                </div>
            </div>
        </>
    )
}
