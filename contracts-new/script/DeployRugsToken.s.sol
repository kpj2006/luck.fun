// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Script} from "forge-std/Script.sol";
import {console2} from "forge-std/console2.sol";
import {RugsToken} from "../src/token/RugsToken.sol";

/**
 * @title DeployRugsToken
 * @notice Deploy the RUGS game token
 */
contract DeployRugsToken is Script {
    function run() public {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        address owner = vm.envOr("OWNER_ADDRESS", vm.addr(deployerPrivateKey));

        console2.log("=== Deploying RUGS Token ===");
        console2.log("Owner:", owner);
        console2.log("");

        vm.startBroadcast(deployerPrivateKey);

        RugsToken token = new RugsToken(owner);

        vm.stopBroadcast();

        console2.log("=== Deployment Summary ===");
        console2.log("Token:", address(token));
        console2.log("Name:", token.name());
        console2.log("Symbol:", token.symbol());
        console2.log("Decimals:", token.decimals());
        console2.log("Initial Supply:", token.totalSupply() / 10**18, "RUGS");
        console2.log("Max Supply:", token.MAX_SUPPLY() / 10**18, "RUGS");
        console2.log("Faucet Enabled:", token.faucetEnabled());
        console2.log("Faucet Amount:", token.FAUCET_AMOUNT() / 10**18, "RUGS");
        console2.log("");

        console2.log("=== Next Steps ===");
        console2.log("1. Update .env: GAME_TOKEN_ADDRESS=" , address(token));
        console2.log("2. Redeploy contracts: forge script script/Deploy.s.sol --rpc-url $RPC_URL --broadcast --slow");
        console2.log("3. Test faucet: cast send", address(token), "\"claimFaucet()\" --rpc-url $RPC_URL --private-key $PRIVATE_KEY");
    }
}
