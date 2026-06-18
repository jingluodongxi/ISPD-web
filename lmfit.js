// ISPD LM Fitting Engine — with parameter bounds projection at each step
var LM = (function() {
'use strict';

function zeros(r,c){var m=new Array(r);for(var i=0;i<r;i++){m[i]=new Array(c);for(var j=0;j<c;j++)m[i][j]=0;}return m;}
function transpose(A){var r=A.length,c=A[0].length,T=zeros(c,r);for(var i=0;i<r;i++)for(var j=0;j<c;j++)T[j][i]=A[i][j];return T;}
function matMul(A,B){var aR=A.length,aC=A[0].length,bC=B[0].length,C=zeros(aR,bC);for(var i=0;i<aR;i++)for(var k=0;k<aC;k++)if(A[i][k]!==0)for(var j=0;j<bC;j++)C[i][j]+=A[i][k]*B[k][j];return C;}

function solve(A,b){
  var n=A.length,aug=new Array(n);
  for(var i=0;i<n;i++){aug[i]=new Array(n+1);for(var j=0;j<n;j++)aug[i][j]=A[i][j];aug[i][n]=Array.isArray(b[i])?b[i][0]:b[i];}
  for(var col=0;col<n;col++){
    var maxVal=Math.abs(aug[col][col]),maxRow=col;
    for(var row=col+1;row<n;row++){if(Math.abs(aug[row][col])>maxVal){maxVal=Math.abs(aug[row][col]);maxRow=row;}}
    if(maxVal<1e-30)continue;
    var tmp=aug[col];aug[col]=aug[maxRow];aug[maxRow]=tmp;
    for(var row=col+1;row<n;row++){var f=aug[row][col]/aug[col][col];for(var j=col;j<=n;j++)aug[row][j]-=f*aug[col][j];}
  }
  var x=new Array(n);
  for(var i=n-1;i>=0;i--){x[i]=aug[i][n];for(var j=i+1;j<n;j++)x[i]-=aug[i][j]*x[j];x[i]/=(Math.abs(aug[i][i])>1e-30)?aug[i][i]:1;}
  return x;
}

function clamp(p,lo,hi){
  var q=p.slice();
  for(var i=0;i<p.length;i++){
    if(lo&&lo[i]!==undefined)q[i]=Math.max(lo[i],q[i]);
    if(hi&&hi[i]!==undefined)q[i]=Math.min(hi[i],q[i]);
  }
  return q;
}

function lmFit(modelFn,jacFn,xData,yData,p0,opts){
  opts=opts||{};
  var maxIter=opts.maxIter||300,lambda=opts.lambda0||1e-2;
  var xtol=opts.xtol||1e-12,lambdaUp=10,lambdaDown=10;
  var lo=opts.lower||null,hi=opts.upper||null;
  var n=xData.length,m=p0.length;
  var params=clamp(p0,lo,hi);

  function costFn(p){var c=0;for(var i=0;i<n;i++){var r=yData[i]-modelFn(p,xData[i]);if(!isFinite(r))return Infinity;c+=r*r;}return c/n;}

  var cost=costFn(params);
  if(!isFinite(cost))return{params:params,cost:1e10};

  for(var iter=0;iter<maxIter;iter++){
    var J=zeros(n,m),r=zeros(n,1);
    for(var i=0;i<n;i++){
      var jr=jacFn(params,xData[i]),yp=modelFn(params,xData[i]);
      r[i][0]=yData[i]-yp;
      for(var j=0;j<m;j++)J[i][j]=jr[j];
    }
    var JT=transpose(J),JTJ=matMul(JT,J),JTr=matMul(JT,r);
    var A=zeros(m,m);
    for(var j=0;j<m;j++){for(var k=0;k<m;k++)A[j][k]=JTJ[j][k];A[j][j]+=lambda*Math.max(JTJ[j][j],1e-6);}
    var dp=solve(A,JTr);
    var maxDp=0;for(var j=0;j<m;j++)maxDp=Math.max(maxDp,Math.abs(dp[j]));

    // Apply step and clamp to bounds
    var newParams=new Array(m);
    for(var j=0;j<m;j++)newParams[j]=params[j]+dp[j];
    newParams=clamp(newParams,lo,hi);

    // If step was clamped back, reduce step size
    for(var j=0;j<m;j++){
      if(lo&&lo[j]!==undefined&&params[j]<=lo[j]+1e-8&&dp[j]<0)newParams[j]=params[j];
      if(hi&&hi[j]!==undefined&&params[j]>=hi[j]-1e-8&&dp[j]>0)newParams[j]=params[j];
    }

    var newCost=costFn(newParams);
    if(newCost<cost&&isFinite(newCost)){
      lambda/=lambdaDown;cost=newCost;params=newParams.slice();
      if(maxDp<xtol)break;
    }else{
      lambda*=lambdaUp;
    }
  }
  return{params:params,cost:cost};
}

// Models
function doubleExpModel(p,t){
  return p[0]*Math.exp(-t/Math.max(Math.abs(p[1]),0.1))+p[2]*Math.exp(-t/Math.max(Math.abs(p[3]),0.1))+p[4];
}
function doubleExpJac(p,t){
  var A1=p[0],t1=Math.max(Math.abs(p[1]),0.1),A2=p[2],t2=Math.max(Math.abs(p[3]),0.1);
  var e1=Math.exp(-t/t1),e2=Math.exp(-t/t2);
  return[e1,A1*(t/(t1*t1))*e1,e2,A2*(t/(t2*t2))*e2,1];
}
function singleExpModel(p,t){return p[0]*Math.exp(-t/Math.max(Math.abs(p[1]),0.1))+p[2];}
function singleExpJac(p,t){
  var A=p[0],tau=Math.max(Math.abs(p[1]),0.1),e=Math.exp(-t/tau);
  return[e,A*(t/(tau*tau))*e,1];
}
function exp2Model(p,t){return p[0]*Math.exp(-t/Math.max(Math.abs(p[1]),0.1));}
function exp2Jac(p,t){
  var A=p[0],tau=Math.max(Math.abs(p[1]),0.1),e=Math.exp(-t/tau);
  return[e,A*(t/(tau*tau))*e];
}

// Two-stage robust fit with bounded LM
function fitDoubleExponential(t,v,vDrop,tRange){
  vDrop=vDrop||(v[0]-v[v.length-1]);
  tRange=tRange||(t[t.length-1]-t[0]);
  var vEnd=v[v.length-1],vStart=v[0];
  var tauMax=20*tRange;
  var AMax=5*Math.max(vDrop,vStart,0.01);

  // === Stage 1: Bounded single exponential ===
  var lo1=[0,1,vEnd-vDrop*0.8];
  var hi1=[AMax,tauMax,vEnd+vDrop*0.8];
  var p01=[vDrop*0.8,tRange*0.25,vEnd];
  var s1=lmFit(singleExpModel,singleExpJac,t,v,p01,{maxIter:200,lower:lo1,upper:hi1});
  var A_s=s1.params[0],tau_s=Math.max(1,s1.params[1]),y0_s=s1.params[2];

  // Residual
  var resid=new Array(t.length);
  for(var i=0;i<t.length;i++)resid[i]=v[i]-(A_s*Math.exp(-t[i]/tau_s)+y0_s);

  // === Stage 2: Second exponential from residual ===
  var nHalf=Math.max(10,Math.floor(t.length/2));
  var tE=t.slice(0,nHalf),rE=resid.slice(0,nHalf);
  var maxRes=Math.max.apply(null,rE.map(Math.abs));
  var lo2=[0,1],hi2=[AMax,tauMax];
  var s2=lmFit(exp2Model,exp2Jac,tE,rE,[maxRes*0.6,50],{maxIter:150,lower:lo2,upper:hi2});
  var A_r=s2.params[0],tau_r=Math.max(1,s2.params[1]);

  // === Stage 3: Full double-exp ===
  var A1i,t1i,A2i,t2i,y0i;
  if(tau_s<=tau_r){A1i=A_s;t1i=tau_s;A2i=A_r;t2i=Math.max(tau_r,tau_s*3);y0i=y0_s;}
  else{A1i=A_r;t1i=tau_r;A2i=A_s;t2i=Math.max(tau_s,tau_r*3);y0i=y0_s;}

  var p0Sets=[
    [A1i,t1i,A2i,t2i,y0i],
    [A1i*0.8,t1i*0.7,A2i*1.2,t2i,y0i],
    [A1i*1.2,t1i,A2i*0.8,t2i*1.3,y0i],
    [A1i,t1i*1.5,A2i,t2i*0.8,vEnd],
  ];

  var lo5=[0,1,0,1,vEnd*0.5];
  var hi5=[AMax,tauMax,AMax,tauMax,vEnd+vDrop*2];

  var bestP=null,bestCost=Infinity;
  for(var k=0;k<p0Sets.length;k++){
    try{
      var r=lmFit(doubleExpModel,doubleExpJac,t,v,p0Sets[k],{maxIter:300,lower:lo5,upper:hi5});
      if(r.cost<bestCost&&isFinite(r.cost)){bestCost=r.cost;bestP=r.params.slice();}
    }catch(e){}
  }
  if(!bestP)bestP=[A1i,t1i,A2i,t2i,y0i];

  var A1=Math.max(0,Math.min(bestP[0],AMax));
  var tau1=Math.max(0.1,Math.min(Math.abs(bestP[1]),tauMax));
  var A2=Math.max(0,Math.min(bestP[2],AMax));
  var tau2=Math.max(0.1,Math.min(Math.abs(bestP[3]),tauMax));
  var y0=Math.max(vEnd*0.5,Math.min(bestP[4],vEnd+vDrop*2));

  if(tau1>tau2){var ta=A1,tt=tau1;A1=A2;tau1=tau2;A2=ta;tau2=tt;}

  // R2
  var ssRes=0,ssTot=0,vMean=0;
  for(var i=0;i<v.length;i++)vMean+=v[i];
  vMean/=v.length;
  for(var i=0;i<v.length;i++){
    var pred=A1*Math.exp(-t[i]/tau1)+A2*Math.exp(-t[i]/tau2)+y0;
    ssRes+=(v[i]-pred)*(v[i]-pred);
    ssTot+=(v[i]-vMean)*(v[i]-vMean);
  }
  return{A1:A1,tau1:tau1,A2:A2,tau2:tau2,y0:y0,r2:Math.max(0,1-ssRes/(ssTot||1)),success:bestP!==null};
}

return{lmFit:lmFit,doubleExpModel:doubleExpModel,doubleExpJacobian:doubleExpJac,fitDoubleExponential:fitDoubleExponential};
})();
