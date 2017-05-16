function foo(x){
	return new Promise((resolve)=>{
		setTimeout(()=>{resolve(x * 10)}, 1000)
	})
}
function foo2(x){
	return new Promise((resolve)=>{
		setTimeout(()=>{resolve(x + 10)}, 1000)
	})
}

function foo3(x){
	return new Promise((resolve)=>{
		setTimeout(()=>{resolve(x/2)}, 1000)
	})
}

function *main(x){
	var val = yield foo(x);
	val = yield foo2(val);
	val = yield foo3(val);
	return val;
}