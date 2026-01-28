"""
Seed Sample Embeddings Script
Populates the chat_embeddings table with clinic knowledge for RAG

Run this script after setting up the database:
    uv run python seed_embeddings.py
"""

import asyncio
from app.db.postgres import DataBasePool
from app.services.embedding_service import get_embedding_service


# Sample knowledge base for the clinic
CLINIC_KNOWLEDGE = [
    {
        "content": "Refine Haus Clinic specializes in premium beauty and wellness treatments including facial therapies, laser treatments, and anti-aging procedures.",
        "metadata": {"type": "clinic_info", "category": "general"}
    },
    {
        "content": "Popular facial treatments include Fruit Facial ($80), Anti Acne Facial ($95), Moisturizing Facial ($85), and Glowing Facial ($100). All facials include deep cleansing, extraction, mask, and massage.",
        "metadata": {"type": "service_info", "category": "facials"}
    },
    {
        "content": "Laser treatments are highly effective for hair removal, skin rejuvenation, and pigmentation correction. Laser services range from $150-$300 per session.",
        "metadata": {"type": "service_info", "category": "laser"}
    },
    {
        "content": "Bio Light Therapy uses LED technology to stimulate collagen production, reduce inflammation, and improve skin texture. Recommended for acne treatment and anti-aging.",
        "metadata": {"type": "service_info", "category": "therapy"}
    },
    {
        "content": "For customers with low stock movement items, consider bundling them with popular services. For example, pair moisturizing creams with facial treatments as 'add-on' promotions.",
        "metadata": {"type": "strategy", "category": "promotion"}
    },
    {
        "content": "Best time to run promotions: Week before holidays, beginning of month (payday), and during seasonal changes (summer skincare, winter hydration).",
        "metadata": {"type": "strategy", "category": "promotion"}
    },
    {
        "content": "Customer retention tip: Send personalized messages to customers who haven't visited in 60+ days with a 'We Miss You' discount (10-15% off next service).",
        "metadata": {"type": "strategy", "category": "retention"}
    },
    {
        "content": "Dead stock recommendations: Items unused for 30+ days should be featured in limited-time promotions. Create urgency with 'While Supplies Last' messaging.",
        "metadata": {"type": "strategy", "category": "inventory"}
    },
    {
        "content": "Inventory best practices: Maintain minimum stock levels at 120% of monthly average usage. Reorder when stock falls to 80% of minimum to allow for delivery time.",
        "metadata": {"type": "best_practice", "category": "inventory"}
    },
    {
        "content": "Peak revenue days are typically Friday and Saturday. Consider staffing accordingly and offering Friday-exclusive promotions to maximize revenue.",
        "metadata": {"type": "insight", "category": "operations"}
    },
    {
        "content": "Top-performing services by revenue: Anti Acne Facial, Laser Hair Removal, and Botox treatments consistently generate highest revenue per appointment.",
        "metadata": {"type": "insight", "category": "revenue"}
    },
    {
        "content": "Customer loyalty program: Members with wallet balances spend 35% more on average and visit 2x more frequently. Encourage wallet top-ups with bonus credits.",
        "metadata": {"type": "insight", "category": "loyalty"}
    },
    {
        "content": "When suggesting promotions for skincare products, bundle complementary items: cleanser + toner + moisturizer. Bundles increase average transaction value by 40%.",
        "metadata": {"type": "strategy", "category": "promotion"}
    },
    {
        "content": "Service duration optimization: Schedule longer treatments (laser, facial) during weekdays when demand is lower. Reserve shorter slots for weekends to maximize booking capacity.",
        "metadata": {"type": "strategy", "category": "scheduling"}
    },
    {
        "content": "Anti-aging treatments (Botox, Anti Wrinkle Facial, Skin Rejuvenation) are most popular among customers aged 35-55. Target marketing campaigns to this demographic.",
        "metadata": {"type": "insight", "category": "demographics"}
    },
]


async def seed_embeddings():
    """Main function to seed embeddings into the database."""
    print("🌱 Starting embedding seed process...")

    # Setup database connection
    await DataBasePool.setup()
    pool = DataBasePool.get_pool()

    # Initialize embedding service
    embedding_service = get_embedding_service()

    print(f"📚 Seeding {len(CLINIC_KNOWLEDGE)} knowledge items...")

    try:
        # Batch store all embeddings
        ids = await embedding_service.batch_store_embeddings(
            pool=pool,
            documents=CLINIC_KNOWLEDGE
        )

        print(f"✅ Successfully seeded {len(ids)} embeddings!")
        print(f"   Embedding IDs: {ids[:5]}..." if len(ids) > 5 else f"   Embedding IDs: {ids}")

        # Test search
        print("\n🔍 Testing semantic search...")
        test_queries = [
            "How should I handle slow-moving products?",
            "What promotions work best?",
            "Tell me about facial services"
        ]

        for query in test_queries:
            results = await embedding_service.search_similar(
                pool=pool,
                query=query,
                match_threshold=0.7,
                match_count=3
            )

            print(f"\n   Query: '{query}'")
            print(f"   Found {len(results)} results:")
            for i, result in enumerate(results, 1):
                print(f"      {i}. [{result['similarity']:.2f}] {result['content'][:80]}...")

    except Exception as e:
        print(f"❌ Error seeding embeddings: {e}")
        import traceback
        traceback.print_exc()

    finally:
        # Cleanup
        await DataBasePool.teardown()
        print("\n✨ Seed process completed!")


if __name__ == "__main__":
    asyncio.run(seed_embeddings())
