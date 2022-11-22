function justTesting() {
    
    return new Promise((resolve, reject) => {
      if (true) {
        return resolve("testing");
      } else {
        return reject("promise failed");
     }
   });
  }
  
  justTesting()
    .then(res => {
       let test = res;
       console.log(test)
    })
    .catch(err => {
      console.log(err);
    });