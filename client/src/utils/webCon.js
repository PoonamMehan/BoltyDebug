import { WebContainer } from '@webcontainer/api';
import { useDispatch, useSelector } from 'react-redux';
import { manageChangedFiles, setIframeURL } from '../store/filesAndFoldersSlice';
import store from '../store/store.js'
import { useOutletContext } from "react-router-dom";

const webcontainerInstance = await WebContainer.boot();

export async function createFilesInWCFromObj(filesObj){
    // console.log(Object.keys(filesObj))
    await Promise.all(
        Object.keys(filesObj).map(async(k)=> {
        await createFileInWC(k, filesObj[k])
    })
    );
}


export async function createFilesInWCUsingArray(filesArr, changedFiles, term, dispatch){
    let packageJsonExists = false
    const mySetOfChangedFiles = new Set(changedFiles);

    console.log("ch files", changedFiles)
    console.log("running")

    await Promise.all(filesArr.map(async(task)=>{
        if(task.type == "CreateFile"){
            await createFileInWC(task.path, task.code)
            //if the file's name is package.json -> run npm install -> tell in a variable that npm install ran, because we have seen that because of the systemPrompt, the LLM never sends 'npm install'
            if(task.path.includes("package.json")){
                packageJsonExists = true
            }
            
            //in store, store the name of the changedFiles (reason: we mention all the files in messages[], so we have to keep track of all the files that are changed. And the files are changed by LLM. And the parsed LLM response is processed here, so we update the changedFiles[] in store from here)
            mySetOfChangedFiles.add(task.path)
            
        }else if(task.type == "RunScript"){

            if(task.code == "npm run dev" && packageJsonExists){
                // instance?.writeln('npm install')
                term?.write('npm install')
                await runScriptInWC("npm install", term, dispatch)
                // instance?.writeln(task.code)
                term?.write(task.code)
                await runScriptInWC(task.code, term, dispatch)
            }else if(task.code == "npm run dev"){
                // instance?.writeln(task.code)
                term?.write(task.code)
                await runScriptInWC(task.code, term, dispatch)
            }
            else{
                // instance?.writeln(task.code)
                term?.writeln(task.code)
                await runScriptInWC(task.code, term, dispatch)
            }
        }
    }))
    console.log("Creation of files completed")
    store.dispatch(manageChangedFiles(Array.from(mySetOfChangedFiles)))
}

export async function runScriptInWC(script, term, dispatch){
        
        const scriptArr = script.split(' ');
        const cmdOptnsArr = scriptArr.filter((element, idx)=> idx!=0 )

        console.log("here3")
        console.log(scriptArr[0], cmdOptnsArr)

        const controller = new AbortController();
        const { signal } = controller;
        const cmdOutput = await webcontainerInstance.spawn(scriptArr[0], cmdOptnsArr)

        cmdOutput.output.pipeTo(new WritableStream({
            write(data){
                console.log(data)
                // instance?.write('Welcome react-xtermjs!')
                term?.write(data)
            } 
              
        }))

        // instance?.writeln('')

        if(script.trim() == "npm run dev"){
            console.log(script, "herehrehreh")
            webcontainerInstance.on('server-ready', (port, url)=>{
                console.log("URL", url)
                console.log("port", port)
            dispatch(setIframeURL(url))
            })
        }

        console.log("Script ran: ", script)
}

async function createFileInWC(fileLocation, fileContent){
    //two no folders                 multiple folders
    //string(path) -> take the path and split it at '/' -> if the array.length == 1  then just create that file -> else array[length-1] create file before that from 0 to n-2 (minimum 0th folder) create folders

    const pathArr = fileLocation.split('/')
    const pathArrLen = pathArr.length;

    //if the file is in root folder
    if(pathArrLen == 1){
        const files = {
            [fileLocation]: {
              file: {
                contents: fileContent,
              },
            },
          };
        try{
            await webcontainerInstance.mount(files)
            console.log(fileLocation, " mounted")
        }catch(err){
            console.log("Error while mounting a file in WC: ", err)
        }
    }else{
        //if the file is inside some folder other than the root folder
        let i = 0;
        while(i < pathArrLen-1){
            try{
                await webcontainerInstance.fs.readdir(pathArr.slice(0, i+1).join('/'));
            }catch(err){
                await webcontainerInstance.fs.mkdir(pathArr.slice(0, i+1).join('/') , { recursive: true });
            }
            i++;
        }
        
        const files = {
            [pathArr[pathArrLen-1]]: {
                file: {
                    contents: fileContent,
                },
            },
        };

        try{
            await webcontainerInstance.mount(files, { mountPoint: pathArr.slice(0, pathArrLen-1).join('/') })
            console.log(fileLocation, " mounted")
        }catch(err){
            console.log("Error while mounting a file in WC: ", err)
        }
    }
}

export async function accessFileContentFromWC(filePath){
    console.log("running to access the files")
    const file = await webcontainerInstance.fs.readFile(filePath, 'utf-8');
    return file;
}

export async function getAllCurrentFolderAndFileNamesInWC(folderPath, indent){

    let files = await webcontainerInstance.fs.readdir(folderPath, {
        withFileTypes: true
    })

    files = await Promise.all(files.map(async(currFileOrFolder)=>{
        if(currFileOrFolder.isFile()){
            let indents = ""
            let timesAdded = 0
            while(timesAdded < indent){
                indents += "&nbsp;&nbsp;"
                timesAdded++;
            }
            const val = indents + currFileOrFolder.name
            return {...currFileOrFolder, val: val, path: folderPath+"/"+currFileOrFolder.name}
        }else {
            //insert in files: {...currFileOrFolder, val: val}
            //then insert all the nested filesAndFolders
            if(currFileOrFolder.name != "node_modules"){
                let indents = ""
            let timesAdded = 0
            while(timesAdded < indent){
                indents += "&nbsp;&nbsp;"
                timesAdded++;
            }
            const currFolderPath = folderPath + "/" + currFileOrFolder.name
            const val = indents + currFileOrFolder.name
            let nestedFilesAndFolders = [{...currFileOrFolder, val: val, path: currFolderPath}]
            
            let nestedFiles = await getAllCurrentFolderAndFileNamesInWC(currFolderPath, indent+1)

            nestedFilesAndFolders = [...nestedFilesAndFolders, ...nestedFiles]
            return nestedFilesAndFolders;
            }else{
                return {...currFileOrFolder, val: currFileOrFolder.name, path: "/" + currFileOrFolder.name}
            }
        }
    }))

    
    return files.flat();
}