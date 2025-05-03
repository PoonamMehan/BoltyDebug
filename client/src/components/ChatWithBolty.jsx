import {useDispatch, useSelector} from 'react-redux'
import { useEffect, useState, useRef} from 'react'
import { addMessages, manageChatMsgHistory, manageAllFilesInWC, managePromptsArr} from '../store/filesAndFoldersSlice.js'
import { accessFileContentFromWC } from '../utils/webCon.js'
import { createFilesInWCUsingArray, getAllCurrentFolderAndFileNamesInWC} from '../utils/webCon.js'
import Editor from '@monaco-editor/react';
import arrow from "./next.png"
import { useOutletContext } from "react-router-dom";
import store from '../store/store.js';
import { parseXml } from '../utils/respParser.js'
import '@xterm/xterm/css/xterm.css'

export const ChatWithBolty = ()=>{

    const chatMsgHistory = useSelector((state)=> state.filesAndFolders.chatMsgHistory)
    const promptsArr = useSelector((state)=> state.filesAndFolders.promptsArr)
    const messages = useSelector((state)=> state.filesAndFolders.messages)
    const changedFiles = useSelector((state)=> state.filesAndFolders.changedFiles)
    const [currentPrompt, setCurrentPrompt] = useState("")
    const dispatch = useDispatch();
    const allFilesInWC = useSelector((state)=>state.filesAndFolders.allFilesInWC);
    const [fileContentForMonaco, setFileContentForMonaco] = useState("")
    const [codeIsShown, setCodeIsShown] = useState(true)
    const url = useSelector((state)=> state.filesAndFolders.iframeURL)
    const scrollToBottomDivRef = useRef(null)
    const [localTerminalReady, setLocalTerminalReady] = useState(false)
    const refToTerminalDiv = useRef(null)
    const [terminalInitialised, setTerminalInitialised] = useState(false)

    const {term} = useOutletContext()
    const xtermRef = useRef(null)
    const [termOpened, setTermOpened] = useState(false)
    const termRef = useRef(null);


    useEffect(()=>{console.log("URLh", url)}, [url])

    useEffect(()=>{
        const getDefaultEditorContent = async() => {
            const defaultFileOpenedContent = await accessFileContentFromWC("/package.json")
            setFileContentForMonaco(defaultFileOpenedContent)
        }
        getDefaultEditorContent();
        // term?.open(xtermRef.current)
        // console.log("term", term)

    }, [])

    // useEffect(()=>{
    //     if(codeIsShown){
    //         xtermRef.current = document.getElementById("terminal")
    //         console.log("curr", xtermRef.current)
    //         term?.open(xtermRef.current)
    //         // setTermOpened(true)
    //         console.log("term", term)
    //     }else if(!codeIsShown){
    //         term?.dispose()
    //         // setTermOpened(false)
    //         console.log("curr ref", xtermRef.current)
    //     }
    // }, [codeIsShown, xtermRef])
    useEffect(() => {
        if (codeIsShown) {
          const container = xtermRef.current;
      
          // Only open if the container exists and term hasn't been opened yet
          if (container && term) {
            term.open(container);
            term.write("Terminal is now visible\r\n");
          }
        } else {
          if (term) {
            try {
              term.clear(); // optional: clear instead of dispose if reused elsewhere
              term.reset();
            } catch (err) {
              console.error("Error resetting term:", err);
            }
          }
        }
      }, [codeIsShown, term]);

    async function changeTheFileOpened(filePath){
        console.log("Button clicked")
        const fileContent = await accessFileContentFromWC(filePath)
        setFileContentForMonaco(fileContent)
    }

    const fabricateLastMsg = async(updatedChangedFiles)=>{
        let msg = ''
        const fileContents = await Promise.all(updatedChangedFiles.map(async (filePath) => {
            let currFileContent = await accessFileContentFromWC(filePath);
            return `${filePath}\n\`\`\`\n${currFileContent}\n\`\`\`\n`;
        }));
        msg += fileContents.join(""); // Join all retrieved contents
        return msg;
    }

    const setMessagesInStore = (newMsgs)=>{
        dispatch(addMessages(newMsgs));
    }

    async function getCode(){

        const currentPromptCopy = currentPrompt
        //currenPrompt clear it
        setCurrentPrompt("")

        //as the user enters the prompt and sends it, show it on the left-side chatBox
        const currChatMsgHistory = store.getState().filesAndFolders.chatMsgHistory
        const msgHistory = [...currChatMsgHistory]
        msgHistory.push({role: "user", msg: currentPromptCopy})
        dispatch(manageChatMsgHistory(msgHistory))

        //take in the 
        let extraText = `<bolt_running_commands>\n</bolt_running_commands>\n\nCurrent Message:\n\n${currentPromptCopy}\n\nFile Changes:\n\nHere is a list of all files that have been modified since the start of the conversation.This information serves as the true contents of these files!\n\nThe contents include either the full file contents or a diff (when changes are smaller and localized).\n\nUse it to:\n - Understand the latest file modifications\n - Ensure your suggestions build upon the most recent version of the files\n - Make informed decisions about changes\n - Ensure suggestions are compatible with existing code\n\n`
        const currMessages = store.getState().filesAndFolders.messages
        const newMessagesArr = currMessages.map((msg)=>{return typeof msg === "object"? {...msg} : msg})

        //setting up messages[], which contains all the prompts that we need to send to the LLM
        //adding new prompts 
        const currPromptsArr = store.getState().filesAndFolders.promptsArr
        for(let idx in newMessagesArr){
            if(newMessagesArr[idx] == 0){  
                //currentPrompt + content of files mentioned in changedFiles(analyze the format)
                //<boltcommnad/> Current Prompt. 
                
                const content = extraText + newMessagesArr[idx-1].content
                newMessagesArr[idx] = {role: "user", content: content}


                newMessagesArr[idx-1] = newMessagesArr[idx-2] //now take in effect of this while setting the response in messages
                
                //from idx [3- 0encountered in prompts/reached the end of prompts arr]
                let promptManageIdx = 3
                
                for(let i in currPromptsArr){
                    if(currPromptsArr[i] == 0){
                        break
                    }
                    newMessagesArr[promptManageIdx] = {role: "user", content: currPromptsArr[i]}
                    promptManageIdx++;
                }
               
                break;
            }else if(newMessagesArr[idx] != 0 && idx == 9){
                let promptManageIdx = 3;
                for(let i in currPromptsArr){
                    if(currPromptsArr[i] == 0){
                        break;
                    }
                    newMessagesArr[promptManageIdx] = {role: "user", content: currPromptsArr[i]}
                    promptManageIdx++;
                }
                const content = extraText + newMessagesArr[idx].content
                newMessagesArr[promptManageIdx] = {role: "user", content: content}
            }
        }

        // console.log("chatty new Messages array ", newMessagesArr)
        //set this new and correct msgsArray in store and in session storage
        dispatch(addMessages(newMessagesArr))

        const promptToGetCode = newMessagesArr.filter((curr)=> curr != 0 )//check this: if there are 0s in there, just get rid of them


        //send the req to /get-code endpoint to get all the code files from the backend
        await fetch('/api/v1/chat/get-code', {
            method: "Post",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({"msgs": [...promptToGetCode]}) 
        }).then(async (res)=>{

            if(!res.ok){
                throw new Error(res)
            }
            const decoder = new TextDecoder()
            let result = ""
            await res.body.pipeTo(new WritableStream({
                write(data){
                    result += decoder.decode(data, {stream: true})
                }
            }))
            // console.log("RESULT", result)

            //set response in messages(store)
            const newMessagesArr2 = newMessagesArr.map((msg)=>{return typeof msg === "object"? {...msg} : msg})

            for(let i=0; i<=9; i++){
                if(newMessagesArr2[i] == 0){
                    newMessagesArr2[i-2] = {role: "assistant", content: result}
                    break
                }else if(newMessagesArr2[i] != 0 && i == 9){
                    newMessagesArr2[i-1] = {role: "assistant", content: result}
                }
            }

            // console.log("NewMessagesArr2 ", newMessagesArr2)

            //get the parsed response
            const parsedResp = parseXml(result)

            //add npm install just above nm run dev if package.json exists
            const modifiedChatMsg = parsedResp
            // const msgHistory2 = chatMsgHistory.map((msgObj) => {return {...msgObj}})
            const msgHistory2 = [...msgHistory]
            msgHistory2.push({role: "assistant", msg: modifiedChatMsg}) 
            //save the string to print of the left side in CHATMSGHISTORY(store)
            dispatch(manageChatMsgHistory(msgHistory2))

            await createFilesInWCUsingArray(parsedResp, changedFiles, term, dispatch)

            const nowChangedFiles = store.getState().filesAndFolders.changedFiles
            // console.log('ChangedFiles:' , nowChangedFiles)
            const fabLastMsg = await fabricateLastMsg(nowChangedFiles)


            for(let i=0; i<=9; i++){
                if(newMessagesArr2[i] == 0){
                    newMessagesArr2[i-1] = {role: "user", content: fabLastMsg}
                    break
                }else if(newMessagesArr2[i] != 0 && i == 9){
                    newMessagesArr2[i] = {role: "assistant", content: fabLastMsg}
                }
            }

            // console.log("newMessagesArray2 herehere ", newMessagesArr2)

            //save the newMessagesArr2 in store dispatch()
            dispatch(addMessages(newMessagesArr2))

            //save the prompt in the promptsArr (and firstly we have cosumed the content of promptsArr)
            const newPromptsArr = [...currPromptsArr]
            for(let p in newPromptsArr){
                if(newPromptsArr[p] == 0){
                    newPromptsArr[p] = currentPromptCopy;
                    break;
                }else if(p == 4 && newPromptsArr[p] != 0){
                    let idx = 1;
                    while(idx <= 4){
                        newPromptsArr[idx-1] = newPromptsArr[idx]
                        idx++;
                    }
                    newPromptsArr[4] = currentPromptCopy
                }
            }
            dispatch(managePromptsArr(newPromptsArr))

            const allFileAndFolderInWC = await getAllCurrentFolderAndFileNamesInWC('', 0)
            dispatch(manageAllFilesInWC(allFileAndFolderInWC)) 

            //streaming? 
        }).catch((err)=>{
            console.log(err)
        })
    }

    function changeToCode(){
        setCodeIsShown(true)
    }

    function changeToPreview(){
        setCodeIsShown(false)
    }

    return(
        <>
            <div className="flex min-h-screen min-w-screen bg-[#0a0a0a] text-white">
                <div className="flex min-h-screen min-w-screen bg-[radial-gradient(circle_250px_at_20%_-10%,rgba(128,0,255,0.7),rgba(128,0,255,0.2)_60%,transparent_100%)] fixed t-0"></div>
                <div className="flex min-h-screen min-w-screen bg-[radial-gradient(circle_250px_at_10%_-15%,rgba(128,0,255,0.7),rgba(128,0,255,0.2)_60%,transparent_100%)] pl-6 pr-2 pt-4 pb-4 relative t-0">
                {/* Left side chat Box */}
                    
                        <div className="flex flex-col pl-6 overflow-y-auto w-[30%] pr-12">

                            <div className="pl-6">
                                {chatMsgHistory.map((msg, idx)=>{
                                    if(msg.role == "user"){
                                        return (<div key={idx} className="flex flex-row bg-[#262626] items-center px-6 py-3 rounded-md max-w-[570px] mb-5 w-full border-[#59595990] border-[1px]">
                                            {/* <img className="inline-block"></img> */}
                                            <div className="bg-purple-900 rounded-full w-9 h-9 mr-3"></div>
                                            <div className="inline-block">{msg.msg}</div>
                                        </div>)
                                    }else if(msg.role == "assistant"){
                                        return (<div key={idx} className="flex flex-col bg-[#262626] items-center px-6 py-5 rounded-md w-full mb-5 border-[#59595990] border-[1px]">
                                                {msg.msg && msg.msg.map((msgPart, idx)=> {
                                                    if(msgPart.type=="CreateFile"){
                                                        return <p key={idx} className="bg-[#171717] px-4 py-4 w-full">{msgPart.title}</p>
                                                    }else if(msgPart.type=="RunScript"){
                                                        return <p key={idx} className="bg-[#171717] px-4 py-4 w-full">
                                                        <span className="block bg-[#262626] px-4 py-4 rounded-md border-[#59595990] border-[1px]">
                                                            {msgPart.code}
                                                        </span>
                                                    </p>
                                                    }else if(msgPart.type=="Artifacts"){
                                                        return <p key={idx} className="bg-[#171717] px-4 py-4 w-full rounded-t-md">{msgPart.title}</p>
                                                    }else if(msgPart.type=="ExtraText"){
                                                        return <p key={idx} className="mb-4 w-full">{msgPart.content}</p>
                                                    }
                                                })}
                                                </div>
                                            )}})}
                                <div ref={scrollToBottomDivRef}></div>     
                            </div>

                            <div className="flex flex-row pl-6">
                                <input type="text" onChange={(e)=>setCurrentPrompt(e.target.value)} className="flex-1 bg-[#262626] p-2 rounded-md text-white focus:outline-none" value={currentPrompt} onKeyDown={(e)=>{
                                    if(e.key == "Enter" && !e.shiftKey){
                                        e.preventDefault()
                                        getCode()
                                    }
                                }}></input>
                                <button className="" onClick={getCode}><div className="bg-[rgba(128,0,255,0.7)] px-1 py-2 rounded-md ml-2"><img src={arrow} alt="Create" className="w-7"></img></div></button>
                            </div> 

                        </div>


                        {/* Project preview and code */}
                        <div className="flex w-[70%] fixed right-0 top-0 flex-col pl-6 h-full pb-4">
                            <div className="flex flex-col absolute top-4 bg-[#1e1e1e] rounded-t-md rounded-r-md border-[1px] border-[#2f2f2f]">
                            <div className="py-1 px-2 border-b-[1px] border-[#2f2f2f] ">
                                <button onClick={changeToCode} className={`mr-1 py-2 px-4 ${codeIsShown? ("bg-[rgba(128,0,255,0.52)] py-2 px-4 rounded-full"):("")}`}>Code</button>
                                <button onClick={changeToPreview} className={`ml-1 py-2 px-4 ${!codeIsShown? ("bg-[rgba(128,0,255,0.54)] py-2 px-4 rounded-full"):("")}`}>Preview</button>
                            </div>
                            {codeIsShown? (<>
                            <div className="flex flex-grow">
                                <div className="flex flex-col p-2 h-[70vh] overflow-y-auto border-r-[1px] border-[#2f2f2f] ">
                                {allFilesInWC.map((element, idx)=>{
                                    return <div key={idx} onClick={()=>changeTheFileOpened(element.path)} className="hover:cursor-pointer whitespace-pre text-gray-300" dangerouslySetInnerHTML={{ __html: `<span style="color: #c1ccc2;">${element.val}</span>` }} ></div>
                                })}
                                </div>
                                <div className="flex-grow">   
                                    <Editor height="70vh" width="58vw" defaultLanguage="javascript" value={fileContentForMonaco} theme="vs-dark"/>
                                </div>
                            </div>
                            
                            </>):(url? (<iframe className="w-[68vw] h-[88vh]" src={url}/>) : (<div className=" w-[68vw] h-[86vh] bg-gray-900 "></div>)
                            )}
                            {codeIsShown? (<div 
                                className="border-[1px] border-t-[4px] border-[#2f2f2f] h-[18vh] w-[100%] bg-[#1e1e1e] overflow-y-auto p-2" id="terminal" ref={xtermRef}
                            ></div> ):(<></>)
                            }
                            {/* {console.log("REF", ref)}
                            {console.log("REF dot curr", ref.current)} */}
                            {/* {localTerminalReady && (
                                // Your terminal content or commands
                                <button onClick={() => instance?.writeln('Hello Terminal!')}>
                                    Test Terminal
                                </button>
                            )} */}
                            {/*<XTerm style={{ width: '100%', height: '18vh' }} options={{ cursorBlink: true }} listeners={{onData}} terminalRef={xTermRef}/> */}
                        </div>
                        </div>
                </div>
            </div>
        </>
    )
}