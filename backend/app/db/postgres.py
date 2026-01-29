import asyncpg
import config
from asyncpg import Pool
from typing import Optional

class UninitializedDatabasePoolError(Exception):
    def __init__(
        self,
        message="The database connection pool has not been properly initialized.Please ensure setup is called",
    ):
        self.message = message
        super().__init__(self.message)


class DataBasePool:

    _db_pool: Optional[Pool] = None

    @classmethod
    async def setup(cls, timeout: Optional[float] = None):
        cls._db_pool = await asyncpg.create_pool(
            database=config.POSTGRES["database"],
            user=config.POSTGRES["user"],
            password=config.POSTGRES["password"],
            host=config.POSTGRES["host"],
            port=config.POSTGRES["port"],
            min_size=1,
            max_size=5,
        )
        cls._timeout = timeout

    @classmethod
    async def get_pool(cls):
        if not cls._db_pool:
            raise UninitializedDatabasePoolError()
        return cls._db_pool

    @classmethod
    async def teardown(cls):
        if not cls._db_pool:
            raise UninitializedDatabasePoolError()
        await cls._db_pool.close()
