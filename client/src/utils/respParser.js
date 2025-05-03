const StepType = {
    CreateFile: "CreateFile",
    Artifacts: "Artifacts",
    RunScript: "RunScript"
}

export function parseXml(response) {
    // Extract the XML content between <boltArtifact> tags
    const xmlMatch = response.match(/([\s\S]*?)<boltArtifact([^>]*)>([\s\S]*?)<\/boltArtifact>([\s\S]*)/);
    
    if (!xmlMatch) {
      return [];
    }
    //xmlMatch[0] will contain the whole matched string, and in our case it will contain the input string itself
    
    const steps = [];
    //steps[0] will have the text before the <boltArtifact></boltArtifact>
    const boltArtifactAttr = xmlMatch[2];
    steps.push({
      type: "ExtraText",
      content: xmlMatch[1].trim(),
    })

    const xmlContent = xmlMatch[3];
    let stepId = 1;
  
    // Extract artifact title
    const titleMatch = boltArtifactAttr.match(/title="([^"]*)"/);
    const artifactTitle = titleMatch ? titleMatch[1] : 'Project Files';
  
    // Add initial artifact step
    steps.push({
      id: stepId++,
      title: artifactTitle,
      description: '',
      type: StepType.Artifacts,//changed it to Artifacts
      status: 'pending'
    });
  
    // Regular expression to find boltAction elements
    const actionRegex = /<boltAction\s+type="([^"]*)"(?:\s+filePath="([^"]*)")?>([\s\S]*?)<\/boltAction>/g;
    
    let match;
    while ((match = actionRegex.exec(xmlContent)) !== null) {
      const [, type, filePath, content] = match;
  
      if (type === 'file') {
        // File creation step
        steps.push({
          id: stepId++,
          title: `Create ${filePath || 'file'}`,
          description: '',
          type: StepType.CreateFile,
          status: 'pending',
          code: content.trim(),
          path: filePath
        });
      } else if (type === 'shell') {
        // Shell command step
        steps.push({
          id: stepId++,
          title: 'Run command',
          description: '',
          type: StepType.RunScript,
          status: 'pending',
          code: content.trim()
        });
      }
    }

    steps.push({
      type: "ExtraText",
      content: xmlMatch[4].trim(),
    })
  
    return steps;
  }