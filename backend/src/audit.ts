import { ethers } from "ethers";
import { getContractSolvency, rugsFunContract } from "./lib/contracts";
import { supabase } from "./lib/supabase";

async function runAudit() {
    console.log("🔍 Starting Platform Solvency Audit...");

    // 1. Contract Solvency (Assets vs Liabilities)
    const { assets, liabilities, surplus } = await getContractSolvency();
    console.log(`\n--- Smart Contract ---`);
    console.log(`Assets (ERC20):      ${assets} RUGS`);
    console.log(`Liabilities (Sum):   ${liabilities} RUGS`);
    console.log(`Surplus (Profit):    ${surplus} RUGS`);

    // 2. Off-Chain Sync (Supabase vs Contract)
    // @ts-ignore
    const { data: dbHealth } = await supabase.from("vw_ledger_health").select("*").single();
    const dbLiabilities = dbHealth ? ethers.formatEther(BigInt((dbHealth as any).total_liabilities_nano) * 1_000_000_000n) : "0";
    console.log(`\n--- Database vs Contract ---`);
    console.log(`Supabase Sum:       ${dbLiabilities} RUGS`);
    console.log(`Contract Sum:       ${liabilities} RUGS`);

    const diff = Math.abs(parseFloat(liabilities) - parseFloat(dbLiabilities));

    if (diff < 0.000001) {
        console.log(`\n✅ RECONCILIATION: HEALTHY`);
        console.log(`Off-chain and on-chain records are in perfect sync.`);
    } else {
        console.log(`\n⚠️ RECONCILIATION: DRIFT DETECTED`);
        console.log(`Difference: ${diff} RUGS`);
    }

    process.exit(0);
}

runAudit().catch(err => {
    console.error("Audit failed:", err);
    process.exit(1);
});
