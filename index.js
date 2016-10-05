var ordinalize = require('number-to-words').toWordsOrdinal;
var useLane = require('./lib/use-lane');
var utils = require('./lib/utils');
var instructions = require('./instructions.json');

if (Object !== instructions.constructor) throw 'instructions must be object';

module.exports = function(_version) {
    var version = _version || 'v5';

    return {
        compile: function(step) {
            if (!instructions[version]) { throw new Error('Invalid version'); }
            if (!step.maneuver) throw new Error('No step maneuver provided');

            var type = step.maneuver.type;
            var modifier = step.maneuver.modifier;

            if (!type) { throw new Error('Missing step maneuver type'); }
            if (type !== 'depart' && type !== 'arrive' && !modifier) { throw new Error('Missing step maneuver modifier'); }

            if (!instructions[version][type]) {
                // OSRM specification assumes turn types can be added without
                // major version changes. Unknown types are to be treated as
                // type `turn` by clients
                type = 'turn';
            }

            // Use special instructions if available, otherwise `defaultinstruction`
            var instructionObject;
            if (instructions[version][type][modifier]) {
                instructionObject = instructions[version][type][modifier];
            } else {
                instructionObject = instructions[version][type].default;
            }

            // Special case handling
            var laneInstruction;
            switch (type) {
            case 'use lane':
                var laneDiagram = useLane(step);
                laneInstruction = instructions[version][type].lane_types[laneDiagram];

                if (!laneInstruction) {
                    // If the lane combination is not found, default to continue
                    instructionObject = instructions[version][type].no_lanes;
                }
                break;
            case 'rotary':
            case 'roundabout':
                if (step.rotary_name && step.maneuver.exit && instructionObject.name_exit) {
                    instructionObject = instructionObject.name_exit;
                } else if (step.rotary_name && instructionObject.name) {
                    instructionObject = instructionObject.name;
                } else if (step.maneuver.exit && instructionObject.exit) {
                    instructionObject = instructionObject.exit;
                } else {
                    instructionObject = instructionObject.default;
                }
                break;
            default:
                // NOOP, since no special logic for that type
            }

            // Decide which instruction string to use
            // Destination takes precedence over name
            var instruction;
            if (step.destinations && instructionObject.destination) {
                instruction = instructionObject.destination;
            } else if (step.name && instructionObject.name) {
                instruction = instructionObject.name;
            } else {
                instruction = instructionObject.default;
            }

            // Replace tokens
            // NOOP if they don't exist
            var nthWaypoint = ''; // TODO, add correct waypoint counting
            instruction = instruction
                .replace('{nth}', nthWaypoint)
                .replace('{destination}', (step.destinations || '').split(',')[0])
                .replace('{exit_number}', ordinalize(step.maneuver.exit || 1))
                .replace('{rotary_name}', step.rotary_name)
                .replace('{lane_instruction}', laneInstruction)
                .replace('{modifier}', modifier)
                .replace('{direction}', utils.getDirectionFromDegree(step)[0])
                .replace('{way_name}', step.name)
                .replace(/ {2}/g, ' '); // remove excess spaces

            return instruction;
        }
    };
};
