export const TRAILER_REVEAL_SECONDS=4;

export function trailerButtonsVisible(currentTime,duration){
  return Number.isFinite(currentTime)&&Number.isFinite(duration)&&duration>0&&currentTime>=Math.max(0,duration-TRAILER_REVEAL_SECONDS);
}

export function spectatorFlightDelta({x=0,z=0,up=0},deltaTime,speed){
  return {x:x*deltaTime*speed,y:up*deltaTime*speed,z:z*deltaTime*speed};
}
