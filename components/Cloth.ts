import * as THREE from 'three';

const DAMPING = 0.03;
const DRAG = 1 - DAMPING;
const TIMESTEP = 18 / 1000;
const TIMESTEP_SQ = TIMESTEP * TIMESTEP;

class Particle {
    position: THREE.Vector3;
    previous: THREE.Vector3;
    original: THREE.Vector3;
    a: THREE.Vector3; // acceleration
    mass: number;
    invMass: number;
    tmp: THREE.Vector3;
    tmp2: THREE.Vector3;

    constructor(x: number, y: number, z: number, mass: number) {
        this.position = new THREE.Vector3(x, y, z);
        this.previous = new THREE.Vector3(x, y, z);
        this.original = new THREE.Vector3(x, y, z);
        this.a = new THREE.Vector3(0, 0, 0);
        this.mass = mass;
        this.invMass = 1 / mass;
        this.tmp = new THREE.Vector3();
        this.tmp2 = new THREE.Vector3();
    }

    addForce(force: THREE.Vector3) {
        this.a.add(
            this.tmp2.copy(force).multiplyScalar(this.invMass)
        );
    }

    integrate() {
        if (this.invMass === 0) return; // Pinned particle
        const newPos = this.tmp.subVectors(this.position, this.previous);
        newPos.multiplyScalar(DRAG).add(this.position);
        newPos.add(this.a.multiplyScalar(TIMESTEP_SQ));

        this.tmp = this.previous;
        this.previous = this.position;
        this.position = newPos;
        this.a.set(0, 0, 0);
    }
}

function plane(width: number, height: number) {
    return function (u: number, v: number, target: THREE.Vector3) {
        const x = (u - 0.5) * width;
        const y = (v - 0.5) * height;
        const z = 0;
        target.set(x, y, z);
    };
}

export class Cloth {
    w: number;
    h: number;
    particles: Particle[];
    constraints: [Particle, Particle, number][];
    plane: (u: number, v: number, target: THREE.Vector3) => void;

    constructor(w = 10, h = 10, restDistance = 25) {
        this.w = w;
        this.h = h;
        this.particles = [];
        this.constraints = [];
        this.plane = plane(w * restDistance, h * restDistance);

        const particles = this.particles;

        // Create particles
        for (let v = 0; v <= h; v++) {
            for (let u = 0; u <= w; u++) {
                const p = new THREE.Vector3();
                this.plane(u / w, v / h, p);
                particles.push(new Particle(p.x, p.y, p.z, 1));
            }
        }

        // Structural constraints
        for (let v = 0; v <= h; v++) {
            for (let u = 0; u <= w; u++) {
                if (u < w) {
                    this.constraints.push([
                        particles[this.index(u, v)],
                        particles[this.index(u + 1, v)],
                        restDistance
                    ]);
                }
                if (v < h) {
                    this.constraints.push([
                        particles[this.index(u, v)],
                        particles[this.index(u, v + 1)],
                        restDistance
                    ]);
                }
            }
        }
    }

    index(u: number, v: number) {
        return u + v * (this.w + 1);
    }

    satisfyConstraints(p1: Particle, p2: Particle, distance: number) {
        const diff = new THREE.Vector3().subVectors(p2.position, p1.position);
        const currentDist = diff.length();
        if (currentDist === 0) return;
        const correction = diff.multiplyScalar((currentDist - distance) / currentDist);
        
        // Adjust positions based on inverse mass (pinned particles won't move)
        const totalInvMass = p1.invMass + p2.invMass;
        if (totalInvMass > 0) {
            const p1Factor = p1.invMass / totalInvMass;
            const p2Factor = p2.invMass / totalInvMass;
            p1.position.add(correction.clone().multiplyScalar(p1Factor));
            p2.position.sub(correction.clone().multiplyScalar(p2Factor));
        }
    }

    simulate(gravity: THREE.Vector3, colliders: THREE.Sphere[]) {
        const particles = this.particles;

        // Apply gravity and integrate
        for (const particle of particles) {
            particle.addForce(gravity);
            particle.integrate();
        }

        // Apply constraints multiple times for stiffness
        const constraints = this.constraints;
        for (let i = 0; i < 2; i++) {
             for (const constraint of constraints) {
                this.satisfyConstraints(constraint[0], constraint[1], constraint[2]);
            }
        }
        
        // Sphere colliders
        for (const particle of particles) {
            for (const sphere of colliders) {
                const diff = new THREE.Vector3().subVectors(particle.position, sphere.center);
                if (diff.length() < sphere.radius) {
                    diff.normalize().multiplyScalar(sphere.radius);
                    particle.position.copy(sphere.center).add(diff);
                }
            }
        }
    }
}