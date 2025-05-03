import { ChatWithBolty } from "../components/ChatWithBolty.jsx"
export const CurrentProject = () => {
    return(
        <>
        {/* chat on the left
            
            code and preview
                file structure
                monaco text editor(to allow editing wherever the user edits, give the content of that file along with the current user prompt in the last message)
        
            three components: left chat thingy, the code(file list + monaco + terminal), preview
            
            

         */}

            <ChatWithBolty/>
        </>
    )
}