import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs";
import { geoContains } from "d3-geo";
import type { Feature, MultiPolygon, Polygon, Position } from "geojson";
import { feature } from "topojson-client";
import type { SeattleSubmarket } from "../lib/seattle-market-deep-dive/types.ts";
import { createSyntheticAnalysisZones } from "../lib/evaluation/zones.ts";

const topology=JSON.parse(fs.readFileSync(new URL("../data/public/census/cbsa-geometry/2024/markets.topo.json",import.meta.url),"utf8"));
const collection=feature(topology,topology.objects.markets) as unknown as {features:Array<Feature<Polygon|MultiPolygon,{cbsa_code:string}>>};
const parent=collection.features.find((item)=>item.properties.cbsa_code==="42660")!;
const rawSubmarkets=JSON.parse(fs.readFileSync(new URL("../data/synthetic/seattle-market-deep-dive/v1/submarkets.json",import.meta.url),"utf8"));
const seattleSubmarkets=rawSubmarkets.map((item:SeattleSubmarket)=>({...item,source_id:"SYN-SEATTLE-SUBMARKET-001",evidence_status:"Hypothesis",allowed_use:"synthetic_prototype_only",scoring_eligibility:"synthetic_prototype_only",fixture_version:"test",last_updated_at:"2026-08-03"})) as SeattleSubmarket[];
function pointInRing(point:Position,ring:Position[]){let inside=false;for(let i=0,j=ring.length-1;i<ring.length;j=i++){const xi=ring[i][0],yi=ring[i][1],xj=ring[j][0],yj=ring[j][1];const intersects=(yi>point[1])!==(yj>point[1])&&point[0]<(xj-xi)*(point[1]-yi)/(yj-yi)+xi;if(intersects)inside=!inside;}return inside;}
function containsInterior(geometry:Polygon|MultiPolygon,point:Position){const polygons=geometry.type==="Polygon"?[geometry.coordinates]:geometry.coordinates;return polygons.some((polygon)=>pointInRing(point,polygon[0]));}
function onParentBoundary(point:Position){const polygons=parent.geometry.type==="Polygon"?[parent.geometry.coordinates]:parent.geometry.coordinates;let minimum=Infinity;for(const polygon of polygons)for(let index=0;index<polygon[0].length;index++){const start=polygon[0][index],end=polygon[0][(index+1)%polygon[0].length];const dx=end[0]-start[0],dy=end[1]-start[1],length=dx*dx+dy*dy;if(length===0)continue;const t=Math.max(0,Math.min(1,((point[0]-start[0])*dx+(point[1]-start[1])*dy)/length));minimum=Math.min(minimum,Math.hypot(point[0]-(start[0]+t*dx),point[1]-(start[1]+t*dy)));}return minimum<2e-6;}

test("Seattle zones have stable IDs, deterministic output, and remain inside the parent",()=>{
  const first=createSyntheticAnalysisZones(parent,seattleSubmarkets);const second=createSyntheticAnalysisZones(parent,seattleSubmarkets);
  assert.deepEqual(first,second);assert.equal(first.features.length,7);assert.equal(new Set(first.features.map((feature)=>feature.properties.zone_id)).size,7);
  for(const feature of first.features){const points=(feature.geometry.type==="Polygon"?feature.geometry.coordinates.flat():feature.geometry.coordinates.flat(2));for(const point of points.slice(0,-1))assert.equal(geoContains(parent,point as [number,number])||onParentBoundary(point),true,`${feature.properties.zone_id} escaped parent boundary`);}
});

test("zone interiors do not overlap on a deterministic parent-boundary grid",()=>{
  const zones=createSyntheticAnalysisZones(parent,seattleSubmarkets);const parentPoints=(parent.geometry.type==="Polygon"?parent.geometry.coordinates.flat():parent.geometry.coordinates.flat(2));const xs=parentPoints.map((point)=>point[0]),ys=parentPoints.map((point)=>point[1]);const [minX,maxX,minY,maxY]=[Math.min(...xs),Math.max(...xs),Math.min(...ys),Math.max(...ys)];let inspected=0;
  for(let x=0;x<=60;x++)for(let y=0;y<=60;y++){const point:[number,number]=[minX+(maxX-minX)*x/60,minY+(maxY-minY)*y/60];if(!geoContains(parent,point))continue;inspected++;assert.ok(zones.features.filter((feature)=>containsInterior(feature.geometry,point)).length<=1,`overlap at ${point}`);}
  assert.ok(inspected>100);
});
